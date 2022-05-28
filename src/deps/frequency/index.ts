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
   * @param now 当前时间戳 毫秒值
   */
  const getKey = (ms: number, now = Date.now()) => {
    const t = Math.floor(now / ms);
    return `${KEY}-${ms}-${t}`;
  };

  /**
   * 计算过期时间
   * @param ms 频率控制长度，单位毫秒
   * @param now 当前时间戳 毫秒值
   */
  const expire = (ms: number, now = Date.now()) => {
    const t = Math.floor(now / ms);
    return Math.floor((ms * (t + 1) - now) / 1000);
  };

  /**
   * 频次控制，超过显示过抛出异常
   * @param field 控频字段key
   * @param ms 控频周期长度 毫秒
   * @param limit 控频极限次数
   */
  const control = async (field: string, ms: number, limit: number) => {
    const now = Date.now();
    const key = getKey(ms, now);
    const val = await redis.hincrby(key, field, 1);
    if (val === 1) await redis.expire(key, expire(ms, now));
    if (val > limit) throw Error("Too many request");
    return val;
  };

  /**
   * 检测频次控制，超过显示过抛出异常
   * @param filed 控频字段key
   * @param ms 控频周期长度 毫秒
   * @param limit 控频极限次数
   */
  const check = async (field: string, ms: number, limit: number) => {
    const key = getKey(ms);
    const val = await redis.hget(key, field);
    const value = Number(val) | 0;
    if (value > limit) throw Error("Too many request");
    return value;
  };

  /**
   * 控频计数+1
   * @param filed 控频字段key
   * @param ms 控频周期长度 毫秒
   */
  const incr = async (field: string, ms: number) => {
    const key = getKey(ms);
    const val = await redis.hincrby(key, field, 1);
    if (val === 1) await redis.expire(key, expire(ms));
    return val;
  };

  /**
   * 构造一个控频对象
   * @param filed 控频字段key
   * @param ms 控频周期长度 毫秒
   * @param limit 控频极限次数
   */
  const generate = async (field: string, ms: number, limit: number) => ({
    /** 全流程控制，会自动累加次数 */
    control() {
      return control(field, ms, limit);
    },
    /** 检测是否超限 */
    check() {
      return check(field, ms, limit);
    },
    /** 仅做累加 */
    incr() {
      return incr(field, ms);
    },
  });

  return { control, check, incr, generate };
}
