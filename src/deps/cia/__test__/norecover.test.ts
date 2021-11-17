import { Main as Cia } from "..";

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);
process.on("rejectionHandled", console.error);

const sleep = (MS = 1000) =>
  new Promise((resolve) => {
    setTimeout(resolve, MS);
  });

describe("Cia", () => {
  const cnf = {
    cia: {
      concurrency: 10,
      storeKey: "cia-store",
    },
  };
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  const graceful = {
    exit: jest.fn(),
  };
  const tryCatchLog = jest.fn((fn) => fn);

  const callbacks = {
    test: jest.fn(),
    test2: jest.fn(),
    test3: jest.fn(),
    test4: jest.fn(),
  };

  const waiters = {
    testSave: jest.fn(async () => {
      await sleep(300);
      return { value: "testSave" };
    }),
    test2Save: jest.fn(async () => {
      await sleep(300);
      return { value: "test2Save" };
    }),
    test3Save: jest.fn(async () => {
      await sleep(300);
      return { value: "test3Save" };
    }),
    test4Save: jest.fn(async () => {
      await sleep(300);
      return { value: "test4Save" };
    }),
    test4UpdateCache: jest.fn(async () => {
      await sleep(300);
      return { value: "test4UpdateCache" };
    }),
  };

  const submitValidators = {
    test: jest.fn(),
    test2: jest.fn(),
    test3: jest.fn(),
    test4: jest.fn(),
  };

  const waiterValidators = {
    test: jest.fn(),
  };

  const errorFn = jest.fn();
  const timeoutFn = jest.fn();

  describe("no recover", () => {
    const redis = {
      hset: jest.fn(),
      hdel: jest.fn(),
      hgetall: jest.fn(),
    };
    const deps = {
      logger,
      redis,
      graceful,
      U: { tryCatchLog },
    };
    const cia = Cia(cnf, deps);
    cia.setFn("timeout", timeoutFn);
    cia.setFn("error", errorFn);

    it("regist, case1", async () => {
      const types = [
        {
          type: "save",
          timeout: 30,
          validator: waiterValidators.test,
        },
      ];
      expect(cia.regist("test", submitValidators.test, types)).toBe(1);
      expect(cia.checkReady()).toBe(false);

      expect(cia.getUnlinks()).toEqual(["test::save"]);
    });

    it("regist, case2", async () => {
      const types = [
        {
          type: "save",
          timeout: 20,
        },
      ];
      expect(cia.regist("test2", submitValidators.test2, types)).toBe(2);
      expect(cia.checkReady()).toBe(false);
    });

    it("regist, case3", async () => {
      const types = [
        {
          type: "save",
        },
      ];
      expect(cia.regist("test3", submitValidators.test3, types)).toBe(3);
      expect(cia.checkReady()).toBe(false);
    });

    it("regist, case4", async () => {
      const types = [
        {
          type: "save",
        },
        {
          type: "updateCache",
        },
      ];
      expect(cia.regist("test4", undefined, types)).toBe(4);
      expect(cia.checkReady()).toBe(false);
    });

    it("regist, duplicate error", async () => {
      const types = [
        {
          type: "save",
        },
      ];
      expect(() => cia.regist("test4", undefined, types)).toThrow("has been registed");
      expect(cia.checkReady()).toBe(false);
    });

    it("submit, case1", async () => {
      cia.submit("test", { name: "redstone" }, callbacks.test);
      expect(cia.checkReady()).toBe(false);
    });

    it("submit, case2", async () => {
      cia.submit("test2", { name: "redstone1" }, callbacks.test2);
      expect(cia.checkReady()).toBe(false);
    });

    it("submit, case3", async () => {
      cia.submit("test3", { name: "redstone1" }, callbacks.test3);
      expect(cia.checkReady()).toBe(false);
    });

    it("submit, case4", async () => {
      cia.submit("test4", { name: "redstone1" }, callbacks.test4);
      expect(cia.checkReady()).toBe(false);
    });

    it("submit, case5", async () => {
      expect(cia.submit("test1", { name: "redstone1" }, callbacks.test3)).toBe(undefined);
      expect(logger.error.mock.calls.length).toBe(1);
      expect(logger.error.mock.calls.pop()).toEqual([
        Error(
          "The message has not been registed: test1, data: { name: 'redstone1' }, when will submit",
        ),
      ]);
      expect(cia.checkReady()).toBe(false);
    });

    it("link, case1", async () => {
      cia.link("test", "save", waiters.testSave);
      expect(cia.checkReady()).toBe(false);
    });

    it("link, case2", async () => {
      cia.link("test2", "save", waiters.test2Save);
      expect(cia.checkReady()).toBe(false);
    });

    it("link, case3", async () => {
      cia.link("test3", "save", waiters.test3Save);
      expect(cia.checkReady()).toBe(false);
    });

    it("link, case4", async () => {
      cia.link("test4", "save", waiters.test4Save);
      expect(cia.checkReady()).toBe(false);
    });

    it("link, faild case", async () => {
      expect(() => cia.link("test5", "save", waiters.test4Save)).toThrow("has not been registed");
      expect(cia.checkReady()).toBe(false);
    });

    it("link, faild case2", async () => {
      expect(() => cia.link("test4", "create", waiters.test4Save)).toThrow("link type unknown");
      expect(cia.checkReady()).toBe(false);
    });

    it("link, faild case3", async () => {
      expect(() => cia.link("test4", "save", waiters.test4Save)).toThrow("link type duplicate");
      expect(cia.checkReady()).toBe(false);
    });

    it("link, faild case4", async () => {
      expect(() => cia.link("test4", "save", undefined as unknown as Function)).toThrow(
        "must be a function",
      );
      expect(cia.checkReady()).toBe(false);
    });

    it("link, case5", async () => {
      // 这个 link 之后, 前面submit的消息会被分发执行
      cia.link("test4", "updateCache", waiters.test4UpdateCache);
      expect(cia.checkReady()).toBe(true);
      expect(waiters.testSave.mock.calls.length).toBe(0);
      expect(waiters.test2Save.mock.calls.length).toBe(0);
      expect(waiters.test3Save.mock.calls.length).toBe(0);
      expect(waiters.test4Save.mock.calls.length).toBe(0);
      expect(waiters.test4UpdateCache.mock.calls.length).toBe(0);
      await sleep(700);
    });

    // 验证订阅的函数是否正确执行
    it("dispatch exec assert, link waiter check", async () => {
      expect(waiters.testSave.mock.calls.length).toBe(1);
      expect(waiters.testSave.mock.calls.pop()).toEqual([{ name: "redstone" }]);
      expect(waiters.test2Save.mock.calls.length).toBe(1);
      expect(waiters.test2Save.mock.calls.pop()).toEqual([{ name: "redstone1" }]);
      expect(waiters.test3Save.mock.calls.length).toBe(1);
      expect(waiters.test3Save.mock.calls.pop()).toEqual([{ name: "redstone1" }]);
      expect(waiters.test4Save.mock.calls.length).toBe(1);
      expect(waiters.test4Save.mock.calls.pop()).toEqual([{ name: "redstone1" }]);
      expect(waiters.test4UpdateCache.mock.calls.length).toBe(1);
      expect(waiters.test4UpdateCache.mock.calls.pop()).toEqual([{ name: "redstone1" }]);
    });

    // 验证 submitValidators 是否正确执行
    it("dispatch exec assert, submit validator", async () => {
      expect(submitValidators.test.mock.calls.length).toBe(1);
      expect(submitValidators.test.mock.calls.pop()).toEqual([{ name: "redstone" }]);

      expect(submitValidators.test2.mock.calls.length).toBe(1);
      expect(submitValidators.test2.mock.calls.pop()).toEqual([{ name: "redstone1" }]);

      expect(submitValidators.test3.mock.calls.length).toBe(1);
      expect(submitValidators.test3.mock.calls.pop()).toEqual([{ name: "redstone1" }]);

      expect(submitValidators.test4.mock.calls.length).toBe(0);
    });

    // 验证 waiterValidators 是否正确执行
    it("dispatch exec assert, submit validator", async () => {
      expect(waiterValidators.test.mock.calls.length).toBe(1);
      expect(waiterValidators.test.mock.calls.pop()).toEqual([{ value: "testSave" }]);
    });

    // 验证submit的回调是否正常执行
    it("dispatch exec assert, submit callback check", async () => {
      (() => {
        expect(callbacks.test.mock.calls.length).toBe(1);
        const {
          save: [err, result, consumedMS],
        } = callbacks.test.mock.calls.pop()[0];
        expect(err).toBe(null);
        expect(result).toEqual({ value: "testSave" });
        expect(consumedMS).toBeGreaterThan(290);
      })();

      (() => {
        expect(callbacks.test2.mock.calls.length).toBe(1);
        const {
          save: [err, result, consumedMS],
        } = callbacks.test2.mock.calls.pop()[0];
        expect(err).toBe(null);
        expect(result).toEqual({ value: "test2Save" });
        expect(consumedMS).toBeGreaterThan(290);
      })();

      (() => {
        expect(callbacks.test3.mock.calls.length).toBe(1);
        const {
          save: [err, result, consumedMS],
        } = callbacks.test3.mock.calls.pop()[0];
        expect(err).toBe(null);
        expect(result).toEqual({ value: "test3Save" });
        expect(consumedMS).toBeGreaterThan(290);
      })();

      (() => {
        expect(callbacks.test4.mock.calls.length).toBe(1);
        const {
          save: [err, result, consumedMS],
          updateCache: [err2, result2, consumedMS2],
        } = callbacks.test4.mock.calls.pop()[0];
        expect(err).toBe(null);
        expect(result).toEqual({ value: "test4Save" });
        expect(consumedMS).toBeGreaterThan(290);

        expect(err2).toBe(null);
        expect(result2).toEqual({ value: "test4UpdateCache" });
        expect(consumedMS2).toBeGreaterThan(290);
      })();
    });

    it("dispatch exec assert, setFn call check", async () => {
      // 验证超时函数是否正确执行
      expect(timeoutFn.mock.calls.length).toBe(2);
      (() => {
        const [consumedMS, id, name, type] = timeoutFn.mock.calls.pop();
        expect(consumedMS).toBeGreaterThan(290);
        expect(id.length).toBe(36);
        expect(name).toBe("test2");
        expect(type).toBe("save");
      })();

      (() => {
        const [consumedMS, id, name, type] = timeoutFn.mock.calls.pop();
        expect(consumedMS).toBeGreaterThan(290);
        expect(id.length).toBe(36);
        expect(name).toBe("test");
        expect(type).toBe("save");
      })();
    });

    it("registed failed when cia been ready", async () => {
      expect(() => cia.regist("createEmployee", undefined, [{ type: "updateCache" }])).toThrow(
        "dont registed",
      );
    });

    it("setFn faild", async () => {
      expect(() => cia.setFn("test" as unknown as "error", console.log)).toThrow(
        "unknown type: test",
      );
    });

    it("dispatch exec waiter function faild", async () => {
      waiters.testSave.mockRejectedValueOnce(Error("has error"));
      cia.submit("test", { name: "happen error" });
      await sleep(10);
      expect(waiters.testSave.mock.calls.length).toBe(1);
      expect(waiters.testSave.mock.calls.pop()).toEqual([{ name: "happen error" }]);

      expect(errorFn.mock.calls.length).toBe(1);
      const [err, id, name, type, data] = errorFn.mock.calls.pop();
      expect(err.message).toBe("has error");
      expect(id.length).toBe(36);
      expect(name).toBe("test");
      expect(type).toBe("save");
      expect(data).toEqual({ name: "happen error" });
    });

    it("submit, case6, callback exists but inst a function", async () => {
      cia.submit("test", { name: "redstone1" }, "hello" as unknown as Function);
      expect(cia.checkReady()).toBe(true);
      expect(cia.getUnlinks()).toEqual([]);

      expect(cia.getStats()).toEqual({
        test: {
          pendings: 1,
          doings: 0,
          dones: 1,
          errors: 1,
          _types: [{ type: "save", pendings: 1, doings: 0, dones: 1, errors: 1 }],
        },
        test2: {
          pendings: 0,
          doings: 0,
          dones: 1,
          errors: 0,
          _types: [{ type: "save", pendings: 0, doings: 0, dones: 1, errors: 0 }],
        },
        test3: {
          pendings: 0,
          doings: 0,
          dones: 1,
          errors: 0,
          _types: [{ type: "save", pendings: 0, doings: 0, dones: 1, errors: 0 }],
        },
        test4: {
          pendings: 0,
          doings: 0,
          dones: 1,
          errors: 0,
          _types: [
            { type: "save", pendings: 0, doings: 0, dones: 1, errors: 0 },
            { type: "updateCache", pendings: 0, doings: 0, dones: 1, errors: 0 },
          ],
        },
      });
    });
  });
});
