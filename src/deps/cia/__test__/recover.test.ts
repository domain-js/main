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
    cia: {},
  };
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  const graceful = {
    exit: jest.fn(),
  };
  const tryCatchLog = jest.fn((fn) => fn);

  const waiters = {
    testSave: jest.fn(async () => {
      await sleep(300);
      return { value: "testSave" };
    }),
    testCleanCache: jest.fn(async () => {
      await sleep(300);
      return { value: "cleanCache" };
    }),
  };

  const submitValidators = {
    test: jest.fn(),
  };

  const waiterValidators = {
    test: jest.fn(),
  };

  describe("have to recover", () => {
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
    redis.hgetall.mockResolvedValueOnce({
      message_uuid: JSON.stringify({
        id: "message uuid",
        name: "test",
        data: { name: "recover message" },
        result: {
          save: [null, { value: "testSave" }, 301],
        },
      }),
      message_uuid2: JSON.stringify({
        id: "message uuid2",
        name: "test",
        data: { name: "recover message" },
      }),
      message_uuid3: "hello world",
    });
    redis.hdel.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    it("regist", async () => {
      const types = [
        {
          type: "save",
          timeout: 30,
          validator: waiterValidators.test,
        },
        {
          type: "cleanCache",
          timeout: 30,
        },
      ];
      expect(cia.regist("test", submitValidators.test, types)).toBe(1);
      expect(cia.checkReady()).toBe(false);
    });

    it("link", async () => {
      cia.link("test", "save", waiters.testSave);
      cia.link("test", "cleanCache", waiters.testCleanCache);
      expect(cia.checkReady()).toBe(true);
      await sleep(500);
    });

    it("recover check", async () => {
      expect(waiters.testCleanCache.mock.calls.length).toBe(1);
      expect(waiters.testCleanCache.mock.calls.pop()).toEqual([{ name: "recover message" }]);

      expect(waiters.testSave.mock.calls.length).toBe(0);

      expect(logger.error.mock.calls.length).toBe(1);
    });
  });
});
