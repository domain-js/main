import * as Redis from "ioredis";
import { Main } from "..";

jest.mock("ioredis");

(Redis as any).mockImplementation(() => ({ get: jest.fn(), set: jest.fn() }));

describe("Redis module", () => {
  it("case1", async () => {
    const redis = Main({ redis: {} });
    (redis.get as any).mockResolvedValueOnce("hello world");
    expect(await redis.get("test")).toBe("hello world");
  });
});
