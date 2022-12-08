import { existsSync, mkdirSync } from "fs";
import fs from "fs/promises";
import _ from "lodash";
import path from "path";
import { format } from "util";
import { v4 } from "uuid";

const date = (offset = 0) => new Date(Date.now() + (offset | 0)).toISOString();

interface Cnf {
  logger: {
    level?: "info" | "error" | "none";
    clientId: string;
    errorLogPath: string;
    infoLogPath: string;
    ignoreErrors?: [string | number];
  };
}

interface Deps {
  _: {
    memoize: typeof _.memoize;
  };
  uuid: { v4: typeof v4 };
}

export function Main(cnf: Cnf, deps: Deps) {
  const {
    logger: { level, errorLogPath, infoLogPath, ignoreErrors, clientId },
  } = cnf;
  const {
    _,
    uuid: { v4: uuid },
  } = deps;

  const makeDir = _.memoize((dir) => {
    if (!existsSync(dir)) mkdirSync(dir);
  });

  const ignores = new Set(ignoreErrors);

  const error = (e: any, extra?: any) => {
    if (level === "none") return;
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
    const content = [time, clientId, format(e)];
    if (extra !== null || extra !== undefined) {
      try {
        content.push(JSON.stringify(extra));
      } catch (e) {
        content.push(format(extra));
      }
    }
    if (!e.stack) content.push(format(Error()));
    fs.appendFile(file, `${content.join("\t")}\n`).catch(console.error);
  };

  const info = (message: string, extra?: any) => {
    if (level === "none" || level === "error") return;
    const time = date();
    const today = time.split("T")[0];
    const dir = path.resolve(infoLogPath, today);
    makeDir(dir);
    const file = path.resolve(dir, "info.log");
    const content = [time, clientId, message];
    // eslint-disable-next-line no-eq-null
    if (extra !== null || extra !== undefined) {
      try {
        content.push(JSON.stringify(extra));
      } catch (e) {
        content.push(format(extra));
      }
    }
    fs.appendFile(file, `${content.join("\t")}\n`).catch(console.error);
  };

  const logger = <T extends (...args: any[]) => any>(
    fn: T,
    name: string,
    isAsync = false,
    transform = (x: ReturnType<T>): any => x,
    errorHandler = (e: any) => (e instanceof Error ? e.message : ""),
    argsHandler: (arg: Parameters<T>) => string = JSON.stringify,
  ) => {
    if (level === "none") return fn;
    if (isAsync) {
      const handler = {
        async apply(fn: T, me: any, args: Parameters<T>) {
          const callId = uuid();
          try {
            info(`Begin: ${name}\t${callId}\t${argsHandler(args)}`);
            const startedAt = Date.now();
            const res = await Reflect.apply(fn, me, args);
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
        },
      };

      return new Proxy(fn, handler) as T;
    }

    const handler = {
      apply(fn: T, me: any, args: Parameters<T>) {
        const callId = uuid();
        try {
          info(`Begin: ${name}\t${callId}\t${argsHandler(args)}`);
          const startedAt = Date.now();
          const res = Reflect.apply(fn, me, args);
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
      },
    };

    return new Proxy(fn, handler) as T;
  };

  return { error, info, logger };
}

export const Deps = ["_", "uuid"];
