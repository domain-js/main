import { Main as Counter } from "..";

const redis = {
  hget: jest.fn(),
  hset: jest.fn(),
  hincrby: jest.fn(),
  hmget: jest.fn(),
};
describe("counter", () => {
  const counter = Counter({ counter: { key: "test-key" } }, { redis });

  describe("get", () => {
    it("case1", async () => {
      expect(await counter.get("t1")).toBe(0);
      expect(redis.hget.mock.calls.length).toBe(1);
      expect(redis.hget.mock.calls.pop()).toEqual(["test-key", "t1"]);
    });

    it("case2", async () => {
      redis.hget.mockResolvedValueOnce(200);
      expect(await counter.get("t1")).toBe(200);
      expect(redis.hget.mock.calls.length).toBe(1);
      expect(redis.hget.mock.calls.pop()).toEqual(["test-key", "t1"]);
    });
  });

  describe("set", () => {
    it("case1", async () => {
      redis.hset.mockResolvedValueOnce(1);
      expect(await counter.set("t2", 201)).toBe(1);
      expect(redis.hset.mock.calls.length).toBe(1);
      expect(redis.hset.mock.calls.pop()).toEqual(["test-key", "t2", 201]);
    });

    it("case2", async () => {
      redis.hset.mockRejectedValueOnce(Error("write failed"));
      expect(() => counter.set("t2", 201)).rejects.toThrow("write failed");
      expect(redis.hset.mock.calls.length).toBe(1);
      expect(redis.hset.mock.calls.pop()).toEqual(["test-key", "t2", 201]);
    });
  });

  describe("incr", () => {
    it("case1", async () => {
      redis.hincrby.mockResolvedValueOnce(1);
      expect(await counter.incr("t3")).toBe(1);
      expect(redis.hincrby.mock.calls.length).toBe(1);
      expect(redis.hincrby.mock.calls.pop()).toEqual(["test-key", "t3", 1]);
    });

    it("case2", async () => {
      redis.hincrby.mockRejectedValueOnce(Error("hincrby error"));
      expect(() => counter.incr("t3")).rejects.toThrow("hincrby error");
      expect(redis.hincrby.mock.calls.length).toBe(1);
      expect(redis.hincrby.mock.calls.pop()).toEqual(["test-key", "t3", 1]);
    });
  });
});
