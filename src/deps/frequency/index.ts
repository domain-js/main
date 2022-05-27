import { Redis } from "ioredis";

interface Cnf {
  frequency: {
    key: string;
  };
}

export const Deps = ["redis"] as const;

interface Deps {
  redis: Pick<Redis, "hincrby" | "expire">;
}

export function Main(cnf: Cnf, deps: Deps) {
  const { redis } = deps;
  const {
    frequency: { key: KEY },
  } = cnf;

  const check = async (filed: string, ms: number, limit: number) => {
    const now = Date.now();
    const t = Math.floor(now / ms);
    const key = `${KEY}-${ms}-${t}`;
    const val = await redis.hincrby(key, filed, 1);
    if (val === 1) await redis.expire(key, Math.floor((ms * (t + 1) - now) / 1000));
    if (val > limit) throw Error("Too many request");
  };

  return {
    check,
  };
}
