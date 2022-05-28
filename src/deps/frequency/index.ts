import { Redis } from "ioredis";

interface Cnf {
  frequency: {
    key: string;
  };
}

export const Deps = ["redis"] as const;

interface Deps {
  redis: Pick<Redis, "hincrby" | "expire" | "hget" | "hdel">;
}

export function Main(cnf: Cnf, deps: Deps) {
  const { redis } = deps;
  const {
    frequency: { key: KEY },
  } = cnf;

  /**
   * 计算应该的key
   * @param ms 频率控制长度，单位毫秒
   */
  const getKey = (ms: number) => {
    const now = Date.now();
    const t = Math.floor(now / ms);
    return `${KEY}-${ms}-${t}`;
  };

  /**
   * 计算过期时间
   * @param ms 频率控制长度，单位毫秒
   */
  const expire = (ms: number) => {
    const now = Date.now();
    const t = Math.floor(now / ms);
    return Math.floor((ms * (t + 1) - now) / 1000);
  };

  /**
   * 频次控制，超过显示过抛出异常
   * @param filed 控频字段key
   * @param ms 控频周期长度 毫秒
   * @param limit 控频极限次数
   */
  const control = async (filed: string, ms: number, limit: number) => {
    const key = getKey(ms);
    const val = await redis.hincrby(key, filed, 1);
    if (val === 1) await redis.expire(key, expire(ms));
    if (val > limit) throw Error("Too many request");
  };

  /**
   * 检测频次控制，超过显示过抛出异常
   * @param filed 控频字段key
   * @param ms 控频周期长度 毫秒
   * @param limit 控频极限次数
   */
  const check = async (filed: string, ms: number, limit: number) => {
    const key = getKey(ms);
    const val = await redis.hget(key, filed);
    if (!val) return;
    if ((Number(val) | 0) > limit) throw Error("Too many request");
  };

  return { control, check };
}
