import axios, { AxiosError, AxiosInstance } from "axios";
import { Main as Logger } from "../logger";
import * as utils from "../../utils";

type VERBS = "post" | "get" | "put" | "patch" | "delete";
interface Cnf {
  /** axios config */
  axios?: {
    /** auto record log methods list */
    loggers?: string[];
    /** auto retry methods list */
    retrys?: string[];
    /** retry max times */
    retryTimes?: number;
    /** retry interval millisecond */
    retryIntervalMS?: number;
    /** axios.create the first argument */
    conf?: Parameters<typeof axios.create>[0];
  };
}

interface Deps {
  axios: {
    create: typeof axios.create;
  };
  logger: ReturnType<typeof Logger>;
  utils: {
    sleep: typeof utils.sleep;
  };
}

/**
 * axios module
 * @link https://www.npmjs.com/package/axios
 *
 * @param cnf module initialize config
 * @param deps module initalize dependents
 * @returns returns of axios.create
 */
export function Main(cnf: Cnf, deps: Deps) {
  const axiosError = (e: AxiosError) =>
    (() => {
      if (!e.response) return ["no-response", e.message];
      const r = e.response;
      if (!r.data) return [r.status, r.statusText];
      const d = r.data;
      if (typeof d === "string") return [r.status, d];
      return [d.code || r.status, d.message || JSON.stringify(d)];
    })().join("\t");

  if (!cnf.axios) cnf.axios = {};
  const { loggers, retrys, retryTimes = 3, retryIntervalMS = 3000, conf } = cnf.axios;
  const {
    axios,
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

    return ((...args: FnParameters) => exec(args, 1)) as F;
  };

  const instance: AxiosInstance & {
    /** Original Axios module */
    origin?: typeof axios;
  } = axios.create(conf);

  instance.origin = axios;

  if (loggers) {
    for (const x of loggers as VERBS[]) {
      if (typeof instance[x] !== "function") continue;
      const method = logger.logger(
        instance[x],
        `axios.${x}`,
        true,
        (res: any) => res.data,
        axiosError,
      );

      instance[x] = method;
    }
  }

  if (retrys) {
    for (const x of retrys as VERBS[]) {
      if (typeof instance[x] !== "function") continue;
      instance[x] = retryAble(instance[x], retryTimes, retryIntervalMS);
    }
  }

  return instance;
}

export const Deps = ["logger", "utils", "axios"];
