import { Redis } from "ioredis";

interface Cnf {
  counter: {
    key: string;
  };
}

interface Deps {
  redis: Pick<Redis, "hget" | "hset" | "hincrby" | "hmget">;
}

export function Main(cnf: Cnf, deps: Deps) {
  const {
    counter: { key: REDIS_KEY },
  } = cnf;

  const { redis } = deps;

  /**
   * 获取指定 key 的统计数
   * @param key 要获取的 key
   */
  const get = async (key: string) => {
    const num = await redis.hget(REDIS_KEY, key);

    return Number(num) | 0;
  };

  /**
   * 主动设置某个key为一个数字
   * @param key 要设置的key
   * @param val 要设置的值
   */
  const set = (key: string, val: number) => redis.hset(REDIS_KEY, key, Math.max(0, val | 0));

  /**
   * 某个key自增长1
   * @param key 要自增长的key
   */
  const incr = (key: string) => redis.hincrby(REDIS_KEY, key, 1);

  /**
   * 某个key自减少1
   * @param key 要自减少的key
   */
  const decr = (key: string) => redis.hincrby(REDIS_KEY, key, -1);

  /**
   * 一次获取多个key的统计值
   * @param keys 多个key按序输入, 返回的统计数据为数组，和keys数组保持对应关系
   */
  const mget = async (keys: string[]) => redis.hmget(REDIS_KEY, ...keys);

  return { mget, get, set, incr, decr };
}

export const Deps = ["redis"];
