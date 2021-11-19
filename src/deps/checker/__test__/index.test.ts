import * as async from "async";
import { Main as Helper } from "..";

const errors = {
  notAllowed: jest.fn((m) => Error(`禁止访问: ${m}`)),
};

describe("helpers.checker", () => {
  const cnf = {
    systemAdminList: [1, 2, 3],
  };
  const deps = {
    async,
    errors,
  };

  const helper = Helper(cnf, deps);
  describe("equal", () => {
    it("case1, equal", () => {
      expect(helper.equal(1, 1)).toBe(true);
      expect(helper.equal(0, 0)).toBe(true);
      expect(helper.equal("str", "str")).toBe(true);
    });

    it("case2, not equal", () => {
      expect(helper.equal(1, 0)).toBe(false);
      expect(helper.equal(0, -1)).toBe(false);
      expect(helper.equal("Str", "str")).toBe(false);
      expect(helper.equal([], [])).toBe(false);
      expect(helper.equal([], {})).toBe(false);
      expect(helper.equal({}, {})).toBe(false);
      expect(helper.equal(0, "0")).toBe(false);
      expect(helper.equal(undefined, null)).toBe(false);
    });
  });

  describe("privacy", () => {
    it("case1", async () => {
      const fn = jest.fn();
      fn.mockResolvedValueOnce(true);
      expect(await helper.privacy([[fn, "a", "b"]])).toBe(undefined);

      expect(fn.mock.calls.length).toBe(1);
      expect(fn.mock.calls.pop()).toEqual(["a", "b"]);
    });

    it("case2", async () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      fn1.mockResolvedValueOnce(false);
      fn2.mockResolvedValueOnce(true);
      expect(
        await helper.privacy([
          [fn1, "a", "b"],
          [fn2, "a", "b"],
        ]),
      ).toBe(undefined);

      expect(fn1.mock.calls.length).toBe(1);
      expect(fn1.mock.calls.pop()).toEqual(["a", "b"]);

      expect(fn2.mock.calls.length).toBe(1);
      expect(fn2.mock.calls.pop()).toEqual(["a", "b"]);
    });

    it("case3", async () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      fn1.mockResolvedValueOnce(true);
      expect(
        await helper.privacy([
          [fn1, "a", "b"],
          [fn2, "a", "b"],
        ]),
      ).toBe(undefined);

      expect(fn1.mock.calls.length).toBe(1);
      expect(fn1.mock.calls.pop()).toEqual(["a", "b"]);

      expect(fn2.mock.calls.length).toBe(0);
    });

    it("case4", async () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      fn1.mockResolvedValueOnce(false);
      fn2.mockResolvedValueOnce(false);
      await expect(
        helper.privacy([
          [fn1, "a", "b"],
          [fn2, "a", "b"],
        ]),
      ).rejects.toThrow("禁止访问");

      expect(fn1.mock.calls.length).toBe(1);
      expect(fn1.mock.calls.pop()).toEqual(["a", "b"]);

      expect(fn2.mock.calls.length).toBe(1);
      expect(fn2.mock.calls.pop()).toEqual(["a", "b"]);
    });
  });
});
