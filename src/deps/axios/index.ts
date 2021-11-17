import axios, { AxiosError, AxiosResponse } from "axios";
import { Main as Logger } from "../logger";
import * as utils from "../utils";

type VERBS = "post" | "get" | "put" | "delete";
interface Cnf {
  axios: {
    loggers?: VERBS[];
    retrys?: VERBS[];
    retryTimes?: number;
    retryIntervalMS?: number;
    conf?: {};
  };
}

interface Deps {
  logger: ReturnType<typeof Logger>;
  utils: typeof utils;
}

export function Main(cnf: Cnf, deps: Deps) {
  const axiosError = (e: AxiosError) =>
    (() => {
      if (!e.response) return ["no-response", e.message];
      const r = e.response;
      if (!r.data) return [r.status, r.statusText];
      const d = r.data;
      if (typeof d === "string") return [r.status, d];
      return [d.code || r.status, d.message || d];
    })().join("\t");

  if (!cnf.axios) cnf.axios = {};
  const { loggers, retrys, retryTimes, retryIntervalMS, conf } = cnf.axios;
  const {
    utils: { sleep },
    logger,
  } = deps;

  const retryAble = <F extends (...args: any[]) => any>(fn: F, times: number, interval: number) => {
    type FnParameters = Parameters<F>;
    const exec = async (args: FnParameters, no: number): Promise<ReturnType<F>> => {
      try {
        const res = await fn(...args);
        return res;
      } catch (e) {
        if ((e as AxiosError).code === "ETIMEDOUT") {
          if (interval) await sleep(interval);
          if (times <= no) throw e;
          return exec(args, no + 1);
        }
        throw e;
      }
    };

    return (...args: FnParameters) => exec(args, 1);
  };

  const instance = axios.create(conf);

  if (loggers) {
    for (const x of loggers) {
      const method = logger.logger(
        instance.get,
        `axios.${x}`,
        true,
        (res: any) => res.data,
        axiosError,
      );

      instance[x] = method;
    }
  }

  if (retrys) {
    for (const x of retrys) {
      instance[x] = retryAble(instance[x], retryTimes, retryIntervalMS);
    }
  }

  instance.origin = { ...axios };

  return instance;
}

export const Deps = ["logger", "utils"];
