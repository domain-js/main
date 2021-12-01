import { Main } from "..";

describe("Redis module", () => {
  const IORedis = jest.fn();
  it("case1", async () => {
    const instance = {
      get: jest.fn(),
      set: jest.fn(),
    };
    IORedis.mockImplementationOnce(() => instance);
    const redis = Main({ redis: {} }, { IORedis: IORedis as any });
    (redis.get as any).mockResolvedValueOnce("hello world");
    expect(await redis.get("test")).toBe("hello world");
  });
});
