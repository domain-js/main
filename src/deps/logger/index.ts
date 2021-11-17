import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import { v4 as uuid } from "uuid";

const date = (offset = 0) => new Date(Date.now() + (offset | 0)).toISOString();

interface Cnf {
  logger: {
    clientId: string;
    errorLogPath: string;
    infoLogPath: string;
    ignoreErrors?: [string | number];
  };
}

interface Err extends Error {
  code?: string | number;
  data?: any;
}

export function Main(cnf: Cnf) {
  const {
    logger: { errorLogPath, infoLogPath, ignoreErrors, clientId },
  } = cnf;

  const makeDir = _.memoize((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  });

  const ignores = new Set(ignoreErrors);

  const error = (e: Err, extra?: any) => {
    if (!e) {
      console.trace("Logger.error but error is null or undefined");
      return;
    }
    const time = date();
    const today = time.split("T")[0];
    const code = e.code || "unknown";
    // 忽略某些错误
    if (ignores.has(code)) return;
    const dir = path.resolve(errorLogPath, today);
    makeDir(dir);
    const file = path.resolve(dir, `${code}.err`);
    const content = [time, clientId, e.message];
    if (e.data) content.push(JSON.stringify(e.data));
    if (extra != null) content.push(JSON.stringify(extra));
    if (e.stack) content.push(JSON.stringify(e.stack));
    try {
      fs.appendFileSync(file, `${content.join("\t")}\n`);
    } catch (err) {
      console.error("Logger.error appendFileSync faid: %o", err);
    }
  };

  const info = (message: string, extra?: any) => {
    const time = date();
    const today = time.split("T")[0];
    const dir = path.resolve(infoLogPath, today);
    makeDir(dir);
    const file = path.resolve(dir, "info.log");
    const content = [time, clientId, message];
    if (extra != null) content.push(JSON.stringify(extra));
    try {
      fs.appendFileSync(file, `${content.join("\t")}\n`);
    } catch (e) {
      console.error("Logger.info appendFileSync faid: %o", e);
    }
  };

  const logger = <T extends (...args: any[]) => any>(
    fn: T,
    name: string,
    isAsync = true,
    transform = (x: ReturnType<T>): any => x,
    errorHandler = (e: Err | unknown) => (e instanceof Error ? e.message : ""),
    argsHandler: (arg: Parameters<T>) => string = JSON.stringify,
  ) => {
    if (isAsync) {
      return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        const callId = uuid();
        try {
          info(`Begin: ${name}\t${callId}\t${argsHandler(args)}`);
          const startedAt = Date.now();
          const res = await fn(...args);
          info(
            `Completed: ${name}\t${callId}\t${Date.now() - startedAt}ms\t${JSON.stringify(
              transform(res),
            )}`,
          );
          return res;
        } catch (e) {
          info(`Error: ${name}\t${callId}\t${errorHandler(e)}`, e instanceof Error && e.stack);
          throw e;
        }
      };
    }
    return (...args: Parameters<T>): ReturnType<T> => {
      const callId = uuid();
      try {
        info(`Begin: ${name}\t${callId}\t${argsHandler(args)}`);
        const startedAt = Date.now();
        const res = fn(...args);
        info(`Completed: ${name}\t${callId}\t${Date.now() - startedAt}ms\t${JSON.stringify(res)}`);
        return res;
      } catch (e) {
        if (e instanceof Error) {
          info(`Error: ${name}\t${callId}\t${e.message}`, e.stack);
        } else {
          info(`Error: ${name}\t${callId}\t${e}`, e);
        }
        throw e;
      }
    };
  };

  return { error, info, logger };
}
