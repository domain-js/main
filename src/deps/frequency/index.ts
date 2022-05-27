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

  /**
   * 检测频次控制，超过显示过抛出异常
   * @param filed 控频字段key
   * @param ms 控频周期长度 毫秒
   * @param limit 控频极限次数
   */
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
