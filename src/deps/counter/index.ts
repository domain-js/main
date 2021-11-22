import { Redis } from "ioredis";

interface Cnf {
  counter: {
    key: string;
  };
}

interface Deps {
  redis: Pick<Redis, "hget" | "hset" | "hincrby">;
}

export function Main(cnf: Cnf, deps: Deps) {
  const {
    counter: { key: REDIS_KEY },
  } = cnf;

  const { redis } = deps;

  const get = async (key: string) => {
    const num = await redis.hget(REDIS_KEY, key);

    return Number(num) | 0;
  };

  const set = (key: string, val: number) => redis.hset(REDIS_KEY, key, Math.max(0, val | 0));

  const incr = (key: string) => redis.hincrby(REDIS_KEY, key, 1);

  return { get, set, incr };
}

export const Deps = ["redis"];
