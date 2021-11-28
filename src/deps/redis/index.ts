import * as Redis from "ioredis";

interface Cnf {
  redis: Redis.RedisOptions;
}

/**
 * @link https://www.npmjs.com/package/ioredis
 *
 * Redis module, an instance based on ioredis
 * @param cnf
 * @returns An instance of ioredis
 */
export function Main(cnf: Cnf) {
  const { redis } = cnf;

  return new Redis(redis);
}
