import * as Redis from "ioredis";

interface Cnf {
  redis: Redis.RedisOptions;
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

  return new IORedis(redis);
}

export const Deps = ["IORedis"];
