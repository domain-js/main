import { Main as Parallel } from "..";

describe("Parallel", () => {
  const defaultErrorFn = jest.fn(() => Error("并发控制"));
  const cnf = { parallel: { key: "parallel", defaultErrorFn } };
  const graceful = {
    exit: jest.fn(),
  };
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const redis = {
    del: jest.fn(),
    get: jest.fn(),
    expire: jest.fn(),
    exists: jest.fn(),
    set: jest.fn(),
  };

  const deps = { logger, graceful, utils: { sleep }, redis };

  const fn = jest.fn(async () => {
    await sleep(20);
    return "ok";
  });

  it("case1, noraml", async () => {
    const parallel = Parallel(cnf, deps);
    redis.set.mockResolvedValueOnce(1);
    const fn1 = parallel(fn, { path: "test" });
    expect(await fn1()).toBe("ok");
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls.pop()).toEqual([]);

    // 对redis操作的这几个验证至关重要
    expect(redis.set.mock.calls.length).toBe(1);
    const [KEY, time, ex, life, nx] = redis.set.mock.calls.pop();
    expect(KEY).toBe("parallel::test");
    expect(ex).toBe("EX");
    expect(life).toBe(300);
    expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);
    expect(nx).toBe("NX");

    expect(redis.del.mock.calls.length).toBe(1);
    expect(redis.del.mock.calls.pop()).toEqual(["parallel::test"]);
  });

  it("case2, block execte", async () => {
    const parallel = Parallel(cnf, deps);
    redis.set.mockResolvedValueOnce(0);
    const fn1 = parallel(fn, { path: "test" });
    await expect(fn1()).rejects.toThrow("并发控制");
    expect(fn.mock.calls.length).toBe(0);

    // 对redis操作的这几个验证至关重要
    expect(redis.set.mock.calls.length).toBe(1);
    const [KEY, time] = redis.set.mock.calls.pop();
    expect(KEY).toBe("parallel::test");
    expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);

    expect(redis.del.mock.calls.length).toBe(0);
  });

  it("case3, block execte, needWaitMS, execte once", async () => {
    const parallel = Parallel(cnf, deps);
    redis.set.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const fn1 = parallel(fn, { path: "test", needWaitMS: 10 });
    expect(await fn1()).toBe("ok");
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls.pop()).toEqual([]);

    // 对redis操作的这几个验证至关重要
    expect(redis.set.mock.calls.length).toBe(2);
    for (let i = 0; i < 2; i += 1) {
      const [KEY, time] = redis.set.mock.calls.pop();
      expect(KEY).toBe("parallel::test");
      expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);
    }

    expect(redis.del.mock.calls.length).toBe(1);
    expect(redis.del.mock.calls.pop()).toEqual(["parallel::test"]);
  });

  it("case4, block execte, neverReturn", async () => {
    const parallel = Parallel(cnf, deps);
    redis.set.mockResolvedValueOnce(1);
    const fn1 = parallel(fn, { path: "test", neverReturn: true });
    expect(await fn1()).toBe("ok");
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls.pop()).toEqual([]);

    (() => {
      const [KEY, time] = redis.set.mock.calls.pop();
      expect(KEY).toBe("parallel::test");
      expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);
      // 因为 neverReturn 因此不会删除锁
      expect(redis.del.mock.calls.length).toBe(0);
    })();

    // neverReturn true, so throw error when execte again
    redis.set.mockResolvedValueOnce(0);
    await expect(fn1()).rejects.toThrow("并发控制");
    expect(fn.mock.calls.length).toBe(0);

    (() => {
      const [KEY, time] = redis.set.mock.calls.pop();
      expect(KEY).toBe("parallel::test");
      expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);
      // 因为 被并发控制，因此无须删除锁
      expect(redis.del.mock.calls.length).toBe(0);
    })();

    // dont allow execte again, when exit after
    const [exit] = graceful.exit.mock.calls.pop();
    await exit();
    await expect(fn1()).rejects.toThrow("process exiting");
    expect(fn.mock.calls.length).toBe(0);
    // 引入执行过退出了，所以会执行一次删除锁操作
    // 这个操作是疑问 exit 触发，二维 fn1 执行完毕触发，因为 fn1 是 neverReturn true的
    expect(redis.del.mock.calls.length).toBe(1);
    expect(redis.del.mock.calls.pop()).toEqual(["parallel::test"]);
  });

  it("case5, block execte, needWaitMS", async () => {
    const parallel = Parallel(cnf, deps);
    redis.set.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    redis.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const fn1 = parallel(fn, { path: "test", needWaitMS: 10 });
    expect(await fn1()).toBe("ok");
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls.pop()).toEqual([]);

    await sleep(30);

    // 对redis操作的这几个验证至关重要
    expect(redis.set.mock.calls.length).toBe(2);
    for (let i = 0; i < 2; i += 1) {
      const [KEY, time] = redis.set.mock.calls.pop();
      expect(KEY).toBe("parallel::test");
      expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);
    }

    expect(redis.del.mock.calls.length).toBe(1);
    expect(redis.del.mock.calls.pop()).toEqual(["parallel::test"]);
  });

  it("case6, throw error when fn exected", async () => {
    const parallel = Parallel(cnf, deps);
    redis.set.mockResolvedValueOnce(1);
    const fn1 = parallel(fn, { path: "test" });
    fn.mockRejectedValueOnce(Error("出错了"));
    // 不改变函数原有行为
    await expect(fn1()).rejects.toThrow("出错了");
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls.pop()).toEqual([]);

    // 对redis操作的这几个验证至关重要
    expect(redis.set.mock.calls.length).toBe(1);
    const [KEY, time] = redis.set.mock.calls.pop();
    expect(KEY).toBe("parallel::test");
    expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);

    expect(redis.del.mock.calls.length).toBe(1);
    expect(redis.del.mock.calls.pop()).toEqual(["parallel::test"]);
  });

  it("case7, throw error when fn exected, minMS isnt 0", async () => {
    const parallel = Parallel(cnf, deps);
    redis.set.mockResolvedValueOnce(1);
    const fn1 = parallel(fn, { path: "test", minMS: 10 * 1000 });
    fn.mockRejectedValueOnce(Error("出错了"));
    // 不改变函数原有行为
    await expect(fn1()).rejects.toThrow("出错了");
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls.pop()).toEqual([]);

    // 对redis操作的这几个验证至关重要
    expect(redis.set.mock.calls.length).toBe(1);
    const [KEY, time] = redis.set.mock.calls.pop();
    expect(KEY).toBe("parallel::test");
    expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);

    // 设置有效时间
    expect(redis.expire.mock.calls.length).toBe(1);
    const [KEY1, life] = redis.expire.mock.calls.pop();
    expect(KEY1).toBe("parallel::test");
    expect(life >= 9 && life <= 10).toBe(true);

    // 等待100ms后也不会执行删除，因为前面已经执行了特定时长的有效期
    await sleep(110);
    expect(redis.del.mock.calls.length).toBe(0);
  });

  it("case8, noraml, minMS isnt 0", async () => {
    const parallel = Parallel(cnf, deps);
    redis.set.mockResolvedValueOnce(1);
    const fn1 = parallel(fn, { path: "test", minMS: 10 * 1000 });
    expect(await fn1()).toBe("ok");
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls.pop()).toEqual([]);

    // 对redis操作的这几个验证至关重要
    expect(redis.set.mock.calls.length).toBe(1);
    const [KEY, time] = redis.set.mock.calls.pop();
    expect(KEY).toBe("parallel::test");
    expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);

    // 设置有效时间
    expect(redis.expire.mock.calls.length).toBe(1);
    const [KEY1, life] = redis.expire.mock.calls.pop();
    expect(KEY1).toBe("parallel::test");
    expect(life >= 9 && life <= 10).toBe(true);

    // 等待100ms后也不会执行删除，因为前面已经执行了特定时长的有效期
    await sleep(110);
    expect(redis.del.mock.calls.length).toBe(0);
  });

  it("case9, noraml, keyFn exists", async () => {
    const parallel = Parallel(cnf, deps);
    const keyFn = jest.fn();
    redis.set.mockResolvedValueOnce(1);
    const fn1 = parallel(fn, { path: "test", keyFn });
    keyFn.mockReturnValue("test-key");

    expect(await fn1()).toBe("ok");
    expect(fn.mock.calls.length).toBe(1);
    expect(fn.mock.calls.pop()).toEqual([]);

    // 正确调用了keyFn
    expect(keyFn.mock.calls.length).toBe(1);
    expect(keyFn.mock.calls.pop()).toEqual(["test"]);

    // 对redis操作的这几个验证至关重要
    expect(redis.set.mock.calls.length).toBe(1);
    const [KEY, time] = redis.set.mock.calls.pop();
    expect(KEY).toBe("parallel::test-key");
    expect(time <= Date.now() && Date.now() - 100 < time).toBe(true);

    expect(redis.del.mock.calls.length).toBe(1);
    expect(redis.del.mock.calls.pop()).toEqual(["parallel::test-key"]);
  });
});
