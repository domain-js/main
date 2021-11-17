import { Main } from "..";

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe("cache", () => {
  const cnf = {
    cache: {
      max: 2,
    },
  };
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };

  const deps = { logger };
  describe("caching", () => {
    const fn = jest.fn(async (a: number, b: number) => {
      await sleep(300);
      return a + b;
    });
    const cache = Main(cnf, deps);
    it("case1", async () => {
      const fn1 = cache.caching(fn, 10 * 1000, (a: number, b: number): string => `fn-${a}-${b}`);
      // 第一次执行，没有cache，函数会真实的执行
      expect(await fn1(2, 3)).toBe(5);
      expect(fn.mock.calls.length).toBe(1);
      expect(fn.mock.calls.pop()).toEqual([2, 3]);
      // 第二次执行有cache了，函数不会真实执行，直接从cache中得到结果
      expect(await fn1(2, 3)).toBe(5);
      expect(fn.mock.calls.length).toBe(0);

      // 参数不一致，cache 的key不一样，因此依然会执行
      expect(await fn1(3, 2)).toBe(5);
      expect(fn.mock.calls.length).toBe(1);
      expect(fn.mock.calls.pop()).toEqual([3, 2]);

      // 第三次执行不一样的参数的，函数依然会执行，这次执行过后，第一次执行产生的那个cahce会被清掉
      // 因为我设置的max是2
      expect(await fn1(4, 2)).toBe(6);
      expect(fn.mock.calls.length).toBe(1);
      expect(fn.mock.calls.pop()).toEqual([4, 2]);

      // 第四次执行和第一次执行的参数完全相同，因为cache数量溢出，因此函数依然会执行
      expect(await fn1(2, 3)).toBe(5);
      expect(fn.mock.calls.length).toBe(1);
      expect(fn.mock.calls.pop()).toEqual([2, 3]);

      expect(cache.hitCount()).toEqual({ hits: 1, misseds: 4 });
    });

    it("case3, defined hitFn", async () => {
      const hit = jest.fn();
      const fn1 = cache.caching(fn, 10 * 1000, (a: number, b: number) => `fn-${a}-${b}`, hit);
      expect(await fn1(2, 3)).toBe(5);
      expect(fn.mock.calls.length).toBe(0);

      expect(hit.mock.calls.length).toBe(1);
      expect(hit.mock.calls.pop()).toEqual([true]);

      expect(cache.hitCount()).toEqual({ hits: 2, misseds: 4 });

      expect(await fn1(20, 30)).toBe(50);
      expect(fn.mock.calls.length).toBe(1);
      expect(fn.mock.calls.pop()).toEqual([20, 30]);

      expect(hit.mock.calls.length).toBe(1);
      expect(hit.mock.calls.pop()).toEqual([false]);
      expect(cache.hitCount()).toEqual({ hits: 2, misseds: 5 });
    });
  });
});
