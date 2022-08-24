import { Redis } from "ioredis";

interface Cnf {
  hash: {
    key: string;
  };
}

interface Deps {
  redis: Pick<Redis, "hget" | "hset" | "hdel" | "hincrby">;
}

export function Main(cnf: Cnf, deps: Deps) {
  const {
    hash: { key: REDIS_KEY },
  } = cnf;
  const { redis } = deps;

  const get = async (key: string) => {
    return redis.hget(REDIS_KEY, key);
  };

  const set = (key: string, value: string) => redis.hset(REDIS_KEY, key, value);
  const del = (key: string) => redis.hdel(REDIS_KEY, key);
  const incr = (key: string, step = 1) => redis.hincrby(REDIS_KEY, key, step);

  return { get, set, del, incr };
}

export const Deps = ["redis"];
