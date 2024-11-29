import Redis, { RedisOptions } from "ioredis";

interface Cnf {
  redis: RedisOptions;
}

interface Deps {
  IORedis: typeof Redis;
}

/**
 * @link https://www.npmjs.com/package/ioredis
 *
 * Redis module, an instance based on ioredis
 * @param cnf
 * @returns An instance of ioredis
 */
export function Main(cnf: Cnf, deps: Deps) {
  const { redis } = cnf;
  const { IORedis } = deps;

  const rds = new IORedis(redis);

  /**
   * 在不改变原数据的有效性、过期时间的前提下更新数据
   * @param key redis 存储的 key
   * @param data redis 要更新的数据
   */
  const update = async (key: string, data: string) => {
    const ttl = await rds.ttl(key);
    if (ttl < 1) return;
    await rds.setex(key, ttl, data);
  };

  return Object.assign(rds, { update });
}

export const Deps = ["IORedis"];
