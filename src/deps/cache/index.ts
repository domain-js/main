import { Redis, RedisOptions } from "ioredis";
import { LRUCache } from "lru-cache";

export interface CnfDef {
  cache: {
    isMulti?: boolean;
    delSignalChannel?: string;
  } & LRUCache.Options<{}, {}, unknown>;
  redis?: RedisOptions;
}

export interface DepsDef {
  IORedis: typeof Redis;
  logger: {
    info: (message: string, extra?: any) => void;
    error: (error: Error, extra?: any) => void;
  };
}

export interface Cache extends LRUCache<{}, {}, unknown> {
  caching: <T extends (...args: any[]) => Promise<any>>(
    func: T,
    life: number,
    getKey: (...args: Parameters<T>) => string,
    hit?: (hited: boolean) => void,
  ) => T;
  /**
   * @deprecated use delete instead of del
   */
  del: (key: string) => boolean;
  hitCount: () => { hits: number; misseds: number };
  needToBroad: boolean;
}

export const Deps = ["logger", "LRU", "IORedis"];

export function Main(cnf: CnfDef, deps: DepsDef): Cache {
  let hits = 0; // 击中次数
  let misseds = 0; // 未击中次数
  const { logger, IORedis } = deps;

  const lru = new LRUCache(cnf.cache);
  const isFunction = (arg: any) => typeof arg === "function";

  function caching<T extends (...args: any[]) => Promise<any>>(
    func: T,
    life: number,
    getKey: (...args: Parameters<T>) => string,
    hit?: (hited: boolean) => void,
  ): T {
    if (!isFunction(func)) throw Error("The first argument must be a function");
    if (!Number.isInteger(life) || life < 1)
      throw Error("The second argument must be a number and great then 0");
    if (!isFunction(getKey)) throw Error("The third argument must be a function");
    if (hit && !isFunction(hit)) throw Error("The fourth argument must be a function");

    const wrapped = async (...args: Parameters<T>) => {
      const key = getKey(...args);
      if (lru.has(key)) {
        hits += 1;
        if (hit) hit(true);
        return lru.get(key);
      }
      if (hit) hit(false);
      misseds += 1;
      const res = await func(...args);

      lru.set(key, res, { ttl: life });

      return res;
    };
    return wrapped as T;
  }

  const hitCount = () => ({ hits, misseds });

  const needToBroad = Boolean(cnf.cache.isMulti);
  // 如果不是多节点分部署部署，则不需要处理
  // 开启多节点分布式部署后，要通过redis广播cache的del事件，依次来保持cache的有效性
  if (needToBroad && cnf.redis) {
    const pub = new IORedis(cnf.redis);
    const sub = new IORedis(cnf.redis);

    const { delSignalChannel = "LRU_DEL_SIGNAL_CHANNEL" } = cnf.cache;

    sub.subscribe(delSignalChannel, (err: Error | null | undefined, count: unknown) => {
      logger.info("cache.redis.subscribe", { chanels: delSignalChannel, count });
      if (err) return logger.error(err);
      return logger.info(`cache.redis.subscribe succeed, channel count: ${count}`);
    });

    const del = lru.delete.bind(lru);
    lru.delete = (key: string) => {
      del(key);
      pub.publish(delSignalChannel, key);
      return true;
    };

    sub.on("message", async (channel: string, key: string) => {
      if (channel === delSignalChannel) del(key);
    });
  }

  const cache: Cache = Object.assign(lru, {
    del: lru.delete.bind(lru),
    caching,
    hitCount,
    needToBroad: Boolean(cnf.cache.isMulti),
  });

  return cache;
}
