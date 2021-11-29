import * as async from "async";
import { Redis } from "ioredis";
import { Main as Logger } from "../logger";
import { Main as Graceful } from "../graceful";
import * as utils from "../../utils";

interface Cnf {
  parallel: {
    /** Record the redis key prefix of the concurrency control lock */
    key: string;
    /** Default error handler function */
    defaultErrorFn(path: string, minMS?: number): void;
    /** How long does the reset lock expire (millisecond), default is 100 * 1000 (100 seconds) */
    resetExpireIntervalMS?: number;
    /** Maximum validity period of lock in redis storage (seconds), default is 300 */
    maxExpireSeconds?: number;
  };
}

interface Deps {
  /** logger mudule */
  logger: {
    info: ReturnType<typeof Logger>["info"];
    error: ReturnType<typeof Logger>["error"];
  };
  /** gracefule module */
  graceful: {
    exit: ReturnType<typeof Graceful>["exit"];
  };
  /** redis instance */
  redis: Pick<Redis, "get" | "set" | "del" | "expire" | "exists">;
}

export interface Option {
  // 并发控制key的主路径
  path: string;
  // 并发控制计算key的函数
  keyFn?(...args: any[]): string;
  // 最小执行锁定时间 单位毫秒
  minMS?: number;
  // 错误处理函数
  errorFn?: Function;
  // 是否需要定时去验证获取执行权限
  needWaitMS?: number;
  // 是否需要永久锁定，不返回退出
  neverReturn?: boolean;
}

/**
 * Parallel control module
 * @param cnf Module initialization configuration parameters
 * @param deps Module initialization dependency
 * @returns Parallel control function
 */
export function Main(cnf: Cnf, deps: Deps) {
  const {
    parallel: {
      key: KEY,
      defaultErrorFn,
      maxExpireSeconds = 300,
      resetExpireIntervalMS = 100 * 1000,
    },
  } = cnf;

  const { logger, graceful, redis } = deps;
  const { sleep } = utils;
  // 存放当前处于执行中的 key
  const doings = new Set<string>();

  let exiting = false;
  // 退出时候做的处理
  const onExit = async () => {
    exiting = true;
    logger.info("graceful.onExit parallel start", [...doings]);
    await async.eachLimit([...doings], 10, async (key: string) => {
      doings.delete(key);
      await redis.del(key);
      logger.info(`graceful.onExit parallel del: ${key}`);
    });
    logger.info("graceful.onExit parallel end");
  };

  const delay = async () => {
    if (!doings.size) return;
    await async.eachLimit([...doings], 10, async (key) => {
      await redis.expire(key, maxExpireSeconds);
    });
  };

  async.forever(async () => {
    try {
      await sleep(resetExpireIntervalMS);
      await delay();
    } catch (e) {
      logger.error(e);
    }
  }, logger.error);

  /**
   * Parallel control function
   * @param method Functions that need to control parallel execution
   * @param opt Parallel control parameters
   * @returns Functions with parallel control capability
   */
  function control<F extends(...args: any[]) => any>(method: F, opt: Option) {
    const {
      path,
      keyFn = () => opt.path,
      minMS = 0,
      errorFn = defaultErrorFn,
      needWaitMS = 0,
      neverReturn = false,
    } = opt;

    const error = errorFn(path, minMS);

    const end = async (key: string, startAt: number) => {
      const timing = Date.now() - startAt; // 执行总用时毫秒数
      const remainMS = minMS - timing; // 计算和最小耗时的差值毫秒数
      if (remainMS > 0) {
        await redis.expire(key, (remainMS / 1000) | 0);
      } else {
        await redis.del(key);
      }
      doings.delete(key);
    };

    const paralleled = async (...args: Parameters<F>): Promise<ReturnType<F>> => {
      if (exiting) throw Error("process exiting");
      const key = `${KEY}::${keyFn(path, ...args)}`;
      const ok = await redis.set(key, Date.now(), "EX", 300, "NX");
      if (exiting) {
        await redis.del(key);
        throw Error("process exiting");
      }
      if (!ok) {
        // 不需要等待，则直接抛出异常
        if (!needWaitMS) throw error;

        // 需要等待
        await async.whilst(
          async () => Boolean(await redis.exists(key)),
          async () => sleep(needWaitMS),
        );
        return paralleled(...args);
      }
      const startAt = Date.now(); // 执行开始毫秒数
      doings.add(key);
      try {
        const res = await method(...args);
        if (!neverReturn) await end(key, startAt);
        return res;
      } catch (e) {
        await end(key, startAt);
        throw e;
      }
    };

    return paralleled;
  }

  // 进程退出时候的处理
  graceful.exit(onExit);

  return control;
}

export const Deps = ["logger", "graceful", "redis"];
