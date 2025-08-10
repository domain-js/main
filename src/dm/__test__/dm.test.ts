import * as dm from "..";

const case1 = require("../samples/case1");
const case2 = require("../samples/case2-incorrect");
const case3 = require("../samples/case3-incorrect");
const case5 = require("../samples/case5-incorrect");
const case6 = require("../samples/case6-incorrect");

describe("Dependency Injection Manager.", () => {
  describe("exec", () => {
    it("case1, no hooks", () => {
      const Main = jest.fn();
      Main.mockReturnValueOnce({
        sayHi() {
          return "Hi";
        },
      });
      const main = dm.exec(Main);
      expect(main.sayHi()).toBe("Hi");
      expect(Main.mock.calls.length).toBe(1);
      expect(Main.mock.calls.pop()).toEqual([]);
    });

    it("case2, before hook only", () => {
      const Main = jest.fn();
      const Before = jest.fn();
      Main.mockReturnValueOnce({
        sayHi() {
          return "Hi";
        },
      });
      Before.mockReturnValueOnce([1, 2, 3]);
      const main = dm.exec(Main, Before);
      expect(main.sayHi()).toBe("Hi");

      expect(Before.mock.calls.length).toBe(1);
      expect(Before.mock.calls.pop()).toEqual([]);

      expect(Main.mock.calls.length).toBe(1);
      expect(Main.mock.calls.pop()).toEqual([1, 2, 3]);
    });

    it("case3, after hook only", () => {
      const Main = jest.fn();
      const After = jest.fn();
      Main.mockReturnValueOnce({
        sayHi() {
          return "Hi";
        },
      });
      const main = dm.exec(Main, undefined, After);
      expect(main.sayHi()).toBe("Hi");

      expect(After.mock.calls.length).toBe(1);
      expect(After.mock.calls.pop()).toEqual([main]);

      expect(Main.mock.calls.length).toBe(1);
      expect(Main.mock.calls.pop()).toEqual([]);
    });

    it("case4, before And after hook both exists", () => {
      const Main = jest.fn();
      const Before = jest.fn();
      const After = jest.fn();
      Before.mockReturnValueOnce([1, 2, 3]);
      Main.mockReturnValueOnce({
        sayHi() {
          return "Hi";
        },
      });
      const main = dm.exec(Main, Before, After);
      expect(main.sayHi()).toBe("Hi");

      expect(Before.mock.calls.length).toBe(1);
      expect(Before.mock.calls.pop()).toEqual([]);

      expect(After.mock.calls.length).toBe(1);
      expect(After.mock.calls.pop()).toEqual([main, 1, 2, 3]);

      expect(Main.mock.calls.length).toBe(1);
      expect(Main.mock.calls.pop()).toEqual([1, 2, 3]);
    });
  });

  describe("auto", () => {
    it("case1", () => {
      const deps = {};
      dm.auto(case1, deps, [{}, deps]);

      expect((deps as any).one.sayHi()).toBe("hi from one");
      expect((deps as any).two.sayHi()).toBe("hi from two");
      expect((deps as any).three.sayHi()).toBe("hi from three");
    });

    it("case1-incorrect", () => {
      const deps = { one: "hello" };
      expect(() => {
        dm.auto(case1, deps, [{}, deps]);
      }).toThrow("Name one duplicate");
    });

    it("case1-incorrect After isnot function", () => {
      const deps = {};
      case1.one.After = 1000;
      expect(() => {
        dm.auto(case1, deps, [{}, deps]);
      }).toThrow("After is not a function");
    });

    it("case2-incorrect", () => {
      const deps = {};
      expect(() => {
        dm.auto(case2, deps, [{}, deps]);
      }).toThrow("Deps defined conflict");
    });

    it("case3-incorrect", () => {
      const deps = {};
      expect(() => {
        dm.auto(case3, deps, [{}, deps]);
      }).toThrow("Deps defined conflict");
    });

    it("case6, module must be funciton", () => {
      const deps = {};
      expect(() => {
        dm.auto(case5, deps, [{}, deps]);
      }).toThrow("Main is not a function");
    });

    it("case7, module hooks must be funciton", () => {
      const deps = {};
      expect(() => {
        dm.auto(case6, deps, [{}, deps]);
      }).toThrow("Before is not a function");
    });
  });
});
