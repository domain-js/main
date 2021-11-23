import * as process from "process";
import { Main as LoggerMain } from "../logger";

interface Deps {
  logger: {
    info: ReturnType<typeof LoggerMain>["info"];
  };
}

function Graceful(info: Deps["logger"]["info"]) {
  let exiting = false; // 是否正在退出
  const callbacks: Function[] = [];
  const counter = ((count = 0) => {
    const decr = () => {
      count -= 1;
    };

    const incr = () => {
      count += 1;
    };

    const get = () => count;

    return { incr, decr, get };
  })(0);

  const exitHandle = async () => {
    info("process exiting start");
    if (exiting) {
      info("process exiting..., wait please");
      return;
    }
    exiting = true;
    // 执行事件回调函数
    for (const cb of callbacks) {
      info("process exiting, callback running");
      counter.incr();
      try {
        const ret = cb();
        if (ret && ret.then && ret.catch) {
          ret
            .then(() => {
              counter.decr();
            })
            .catch(() => {
              counter.decr();
            });
        } else {
          counter.decr();
        }
      } catch (e) {
        info("process exiting, callback running faid", e);
        counter.decr();
      }
    }

    // 每秒一次去检测是否所有函数执行都已完毕，可以退出
    const timer = setInterval(() => {
      info(`process exit check count: ${counter.get()}`);
      if (counter.get() > 0) return;

      info("process exit check success, process exited");
      clearInterval(timer);
      process.exit(0);
    }, 1000);
  };

  process.on("SIGTERM", exitHandle);
  process.on("SIGINT", exitHandle);

  /**
   * addListen function be called when process exit
   * @param listenner
   */
  const exit = (listenner: Function) => {
    callbacks.push(listenner);
  };

  function runner<F extends(...args: any[]) => any>(fn: F) {
    return (...args: Parameters<F>) => {
      // 当前状态正在退出，阻止执行函数
      if (exiting) throw Error("process exiting...");
      counter.incr();
      try {
        const res = fn(...args);
        counter.decr();
        return res;
      } catch (e) {
        counter.decr();
        throw e;
      }
    };
  }

  function runnerAsync<F extends(...args: any[]) => Promise<any>>(fn: F) {
    return async (...args: Parameters<F>) => {
      // 当前状态正在退出，阻止执行函数
      if (exiting) throw Error("process exiting");
      counter.incr();
      try {
        const res = await fn(...args);
        counter.decr();
        return res;
      } catch (e) {
        counter.decr();
        throw e;
      }
    };
  }

  const enabled = () => Boolean(!exiting);

  return {
    runner,
    runnerAsync,
    enabled,
    exit,
  };
}

export function Main(cnf: {}, deps: Deps) {
  const { logger } = deps;

  return Graceful(logger.info);
}

export const Deps = ["logger"];
