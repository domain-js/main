import * as Redis from "ioredis";

interface Cnf {
  redis: Redis.RedisOptions;
}

export function Main(cnf: Cnf) {
  const { redis } = cnf;

  return new Redis(redis);
}
