/* eslint-disable import/no-extraneous-dependencies */
import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import * as uuid from "uuid";
import { Main } from "..";

jest.mock("fs");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const clientId = "test-client-id";
const infoLogPath = path.join(__dirname, "log");
const errorLogPath = path.join(__dirname, "log");

const cnf = { logger: { infoLogPath, clientId, errorLogPath } };

const deps = { _, uuid };
describe("Logger module", () => {
  it("instance method", () => {
    const logger = Main(cnf, deps);
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.logger).toBe("function");
  });

  it("info method", () => {
    const logger = Main(cnf, deps);
    logger.info("hello");
    expect(fs.appendFileSync).toHaveBeenCalledTimes(1);
    const [file, line] = (fs.appendFileSync as jest.Mock).mock.calls[0];
    expect(file.slice(0, infoLogPath.length)).toBe(infoLogPath);
    expect(line).toMatch("hello");
  });

  it("info method, has extra", () => {
    const logger = Main(cnf, deps);
    logger.info("hello", "world");
    expect((fs.appendFileSync as jest.Mock).mock.calls.length).toBe(2);
    const [file, line] = (fs.appendFileSync as jest.Mock).mock.calls[1];
    expect(file.slice(0, infoLogPath.length)).toBe(infoLogPath);
    expect(line).toMatch("hello");
    expect(line).toMatch("world");
  });

  it("error method", () => {
    const logger = Main(cnf, deps);
    logger.error(Error("hello"), "world");
    expect((fs.appendFileSync as jest.Mock).mock.calls.length).toBe(3);
    const [file, line] = (fs.appendFileSync as jest.Mock).mock.calls[2];
    expect(file.slice(0, errorLogPath.length)).toBe(errorLogPath);
    expect(line).toMatch("hello");
    expect(line).toMatch("world");
  });

  it("error method, has extra", () => {
    const logger = Main(cnf, deps);
    logger.error(Error("nihao"));
    expect((fs.appendFileSync as jest.Mock).mock.calls.length).toBe(4);
    const [file, line] = (fs.appendFileSync as jest.Mock).mock.calls[3];
    expect(file).toMatch("unknown");
    expect(file.slice(0, errorLogPath.length)).toBe(errorLogPath);
    expect(line).not.toMatch("world");
  });

  it("error method, no stack, has extra", () => {
    const logger = Main(cnf, deps);
    const error = Error("nihao");
    Object.assign(error, { code: "errorCode" });
    logger.error(error);
    expect((fs.appendFileSync as jest.Mock).mock.calls.length).toBe(5);
    const [file, line] = (fs.appendFileSync as jest.Mock).mock.calls[4];
    expect(file.slice(0, errorLogPath.length)).toBe(errorLogPath);
    expect(file).toMatch("errorCode");
    expect(line).not.toMatch("world");
  });

  it("logger sync method, fn exec success", () => {
    const logger = Main(cnf, deps);
    const fn = jest.fn();
    fn.mockReturnValueOnce(10);
    const fnLog = logger.logger(fn, "testing");

    const res = fnLog(1, 2, 3, 4);

    expect(res).toBe(10);
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls[0]).toEqual([1, 2, 3, 4]);

    expect((fs.appendFileSync as jest.Mock).mock.calls.length).toBe(7);
  });

  it("logger sync method, fn exec faild", () => {
    const logger = Main(cnf, deps);
    const calls: any[] = [];
    const fn = (...args: any[]) => {
      calls.push(args);
      throw Error("wrong");
    };
    const fnLog = logger.logger(fn, "testing");

    expect(() => fnLog(1, 2, 3, 4)).toThrow("wrong");
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual([1, 2, 3, 4]);

    expect((fs.appendFileSync as jest.Mock).mock.calls.length).toBe(9);
  });

  it("logger async method, fn exec success", async () => {
    const logger = Main(cnf, deps);
    const calls: any[] = [];
    const ret = "I am function return value";
    const fn = async (...args: any[]) => {
      calls.push(args);
      return new Promise((resolve) => {
        setTimeout(resolve.bind(null, ret), 50);
      });
    };
    const fnLog = logger.logger(fn, "testing", true);

    const res = await fnLog(1, 2, 3, 4);

    expect(res).toBe(ret);
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual([1, 2, 3, 4]);

    expect((fs.appendFileSync as jest.Mock).mock.calls.length).toBe(11);
    expect((fs.appendFileSync as jest.Mock).mock.calls[10][1]).toMatch(ret);
  });

  it("logger async method, fn exec faild", async () => {
    const logger = Main(cnf, deps);
    const calls: any[] = [];
    const fn = async (...args: any[]) => {
      calls.push(args);
      return new Promise((resolve, reject) => {
        setTimeout(reject.bind(null, Error("wrong")), 50);
      });
    };
    const fnLog = logger.logger(fn, "testing", true);

    expect(fnLog(3, 2, 3, 4)).rejects.toThrow("wrong");
    await sleep(51);
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual([3, 2, 3, 4]);

    expect((fs.appendFileSync as jest.Mock).mock.calls.length).toBe(13);
    expect((fs.appendFileSync as jest.Mock).mock.calls[12][1]).toMatch("wrong");
  });

  it("ignore error", async () => {
    const logger = Main({ logger: { ...cnf.logger, ignoreErrors: ["ignored"] } }, deps);
    const error = Error("wrong");
    Object.assign(error, { code: "ignored" });
    logger.error(error);

    expect((fs.appendFileSync as jest.Mock).mock.calls.length).toBe(13);
  });
});
