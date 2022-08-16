import { After } from "../After";

describe("cache", () => {
  const sub = {
    on: jest.fn(),
    subscribe: jest.fn(),
  };
  const pub = {
    publish: jest.fn(),
  };
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  const deps = { logger };
  describe("After, isMulti be false", () => {
    const cnf = {};
    it("case1", () => {
      const lru = { del: jest.fn() };
      After(lru, cnf, deps);

      expect(pub.publish.mock.calls.length).toBe(0);
      expect(sub.subscribe.mock.calls.length).toBe(0);
      expect(sub.on.mock.calls.length).toBe(0);
      expect(logger.info.mock.calls.length).toBe(0);
      expect(logger.error.mock.calls.length).toBe(0);
    });
  });

  describe("After, isMulti be true", () => {
    const cnf = {
      cache: {
        isMulti: true,
        delSignalChannel: "__channel__",
      },
    };
    it("case1", async () => {
      const del = jest.fn();
      const lru = { del };
      After(lru, cnf, deps, { pub, sub });

      expect(pub.publish.mock.calls.length).toBe(0);
      expect(sub.subscribe.mock.calls.length).toBe(1);
      const [channel, subscribeDone] = sub.subscribe.mock.calls.pop();
      expect(channel).toBe("__channel__");
      expect(logger.info.mock.calls.length).toBe(0);
      expect(logger.error.mock.calls.length).toBe(0);
      subscribeDone(null, 1);
      expect(logger.info.mock.calls.length).toBe(2);
      expect(logger.error.mock.calls.length).toBe(0);

      subscribeDone(Error("has error"));
      expect(logger.error.mock.calls.length).toBe(1);

      expect(sub.on.mock.calls.length).toBe(1);
      const [name, listner] = sub.on.mock.calls.pop();
      expect(name).toBe("message");

      lru.del("hello");
      expect(del.mock.calls.length).toBe(1);
      expect(del.mock.calls.pop()).toEqual(["hello"]);
      expect(pub.publish.mock.calls.length).toBe(1);
      expect(pub.publish.mock.calls.pop()).toEqual(["__channel__", "hello"]);
      listner("__channel__", "hello");

      expect(del.mock.calls.length).toBe(1);
      expect(del.mock.calls.pop()).toEqual(["hello"]);

      listner("__channel2__", "hello");
      expect(del.mock.calls.length).toBe(0);
    });
  });
});
