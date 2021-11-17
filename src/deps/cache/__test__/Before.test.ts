import * as Redis from "ioredis";
import { Before } from "../Before";

jest.mock("ioredis");

const IORedisMock = Redis as jest.MockedClass<typeof Redis>;

describe("cache", () => {
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  const deps = { logger };
  describe("Before, isMulti be false", () => {
    const cnf = {
      redis: {},
    };
    it("case1", () => {
      expect(Before(cnf, deps)).toEqual([cnf, deps]);
    });
  });

  describe("After, isMulti be true", () => {
    const cnf = { cache: { isMulti: true }, redis: {} };
    it("case1", () => {
      const args = Before(cnf, deps);
      expect(args[0]).toEqual(cnf);
      expect(args[1]).toEqual(deps);

      expect(IORedisMock).toHaveBeenCalledTimes(2);
      expect(IORedisMock.mock.calls.pop()).toEqual([cnf.redis]);
      expect(IORedisMock.mock.calls.pop()).toEqual([cnf.redis]);
    });
  });
});
