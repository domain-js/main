import * as async from "async";
import { Redis } from "ioredis";
import { OptimisticLockError } from "sequelize/types";
import { Main as Logger } from "../logger";
import { Main as Graceful } from "../graceful";
import * as utils from "../../utils";

interface Cnf {
  parallel: {
    key: string;
    clearTimeout: number;
    defaultErrorFn(path: string, minMS?: number): void;
  };
}

interface Deps {
  logger: {
    info: ReturnType<typeof Logger>["info"];
    error: ReturnType<typeof Logger>["error"];
  };
  graceful: {
    exit: ReturnType<typeof Graceful>["exit"];
  };
  utils: {
    sleep: typeof utils.sleep;
  };
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

export function Main(cnf: Cnf, deps: Deps) {
  const {
    parallel: { key: KEY, defaultErrorFn },
  } = cnf;

  const {
    logger,
    graceful,
    utils: { sleep },
    redis,
  } = deps;
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
    logger.info("start parallel delay keys: %o", doings);
    await async.eachLimit([...doings], 10, async (key) => {
      // 延长 300 秒
      await redis.expire(key, 300);
    });
    logger.info("end parallel delay keys: %o", doings);
  };

  async.forever(async () => {
    try {
      await sleep(100 * 1000);
      await delay();
    } catch (e) {
      logger.error(e);
    }
  }, logger.error);

  /* 将 method 函数处理为有并发控制功能的函数 */
  function control<F extends(...args: any[]) => any>(method: F, opt: Option) {
    const {
      path,
      keyFn = () => opt.path,
      minMS = 0,
      errorFn = defaultErrorFn,
      needWaitMS = 0,
      neverReturn = false,
    } = opt;

    const error = (errorFn || defaultErrorFn)(path, minMS);

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

export const Deps = ["logger", "graceful", "redis", "utils"];
