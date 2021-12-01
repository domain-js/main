import { Before } from "../Before";

describe("cache", () => {
  const IORedis = jest.fn();
  const deps = { IORedis };
  describe("Before, isMulti be false", () => {
    const cnf = {
      redis: {},
    };
    it("case1", () => {
      expect(Before(cnf, deps as any)).toEqual([cnf, deps]);
    });
  });

  describe("Before, isMulti be true", () => {
    const cnf = { cache: { isMulti: true }, redis: {} };
    it("case1", () => {
      const redis1 = {};
      const fn1 = () => redis1;
      const redis2 = {};
      const fn2 = () => redis2;
      IORedis.mockImplementationOnce(fn1).mockImplementationOnce(fn2);

      const args = Before(cnf, deps as any);
      expect(args[0]).toEqual(cnf);
      expect(args[1]).toEqual(deps);

      expect(args[2] && args[2].pub).toBe(redis1);
      expect(args[2] && args[2].sub).toBe(redis2);

      expect(IORedis.mock.calls.length).toBe(2);
      expect(IORedis.mock.results.pop()).toEqual({ type: "return", value: redis2 });
      expect(IORedis.mock.results.pop()).toEqual({ type: "return", value: redis1 });
    });
  });
});
