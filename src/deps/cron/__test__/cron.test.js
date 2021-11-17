const { main: Cron } = require("../dist");

describe("cron", () => {
  const cnf = {};
  const cia = {
    regist: jest.fn(),
    submit: jest.fn(),
    link: jest.fn(),
  };

  const deps = {
    cia,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const cron = Cron(cnf, deps);
  describe("regist", () => {
    it("case1", async () => {
      cron.regist("test", "1 seconds");
      expect(cia.regist.mock.calls.length).toBe(1);
      expect(cia.regist.mock.calls.pop()).toEqual(["Cron::test", null, [{ type: "cronJob" }]]);
    });

    it("case2", async () => {
      cron.regist("test2", "2 hours", "1 seconds");
      expect(cia.regist.mock.calls.length).toBe(1);
      expect(cia.regist.mock.calls.pop()).toEqual(["Cron::test2", null, [{ type: "cronJob" }]]);
    });

    it("case3, name duplicate", async () => {
      expect(() => cron.regist("test", "2 hours", "1 seconds")).toThrow("has been registed");
    });
  });

  describe("getStats", () => {
    it("case1", async () => {
      expect(cron.getStats()).toEqual([
        { name: "test", dones: 0, times: 0, failds: 0, totalMS: 0, avgMS: null },
        { name: "test2", dones: 0, times: 0, failds: 0, totalMS: 0, avgMS: null },
      ]);
    });
  });

  describe("start", () => {
    it("case1", async () => {
      cron.start();
      expect(cron.getStats()).toEqual([
        { name: "test", dones: 0, times: 0, failds: 0, totalMS: 0, avgMS: null },
        { name: "test2", dones: 0, times: 0, failds: 0, totalMS: 0, avgMS: null },
      ]);
      await sleep(2000);
      expect(cia.submit.mock.calls.length).toBe(2);
      const [name1, times1, fn1] = cia.submit.mock.calls.pop();
      expect(name1).toBe("Cron::test2");
      expect(times1).toBe(1);
      expect(fn1.toString()).toMatch("trigger");

      const [name2, times2, fn2] = cia.submit.mock.calls.pop();
      expect(name2).toBe("Cron::test");
      expect(times2).toBe(1);
      expect(fn2.toString()).toMatch("trigger");

      const stats = cron.getStats();
      expect(stats).toEqual([
        { name: "test", dones: 0, times: 1, failds: 0, totalMS: 0, avgMS: null },
        { name: "test2", dones: 0, times: 1, failds: 0, totalMS: 0, avgMS: null },
      ]);
    });

    it("case2 many times to start error", async () => {
      expect(() => cron.start()).toThrow("不能重复启动");
      expect(() => cron.regist("hello", "3 minutes")).toThrow("计划任务系统已经启动");
    });
  });
});

describe("cron special", () => {
  const cnf = {};
  const cia = {
    regist: jest.fn(),
    submit: jest.fn(),
    link: jest.fn(),
  };

  const deps = {
    cia,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  describe("linux style schedule", () => {
    const cron = Cron(cnf, deps);
    it("case1", async () => {
      cron.regist("test", "*/2 * * * * *");
      expect(cia.regist.mock.calls.length).toBe(1);
      expect(cia.regist.mock.calls.pop()).toEqual(["Cron::test", null, [{ type: "cronJob" }]]);

      cron.start();
      await sleep(2010);
      expect(cia.submit.mock.calls.length).toBe(1);
      await (async () => {
        const [name, times, fn] = cia.submit.mock.calls.pop();
        expect(name).toBe("Cron::test");
        expect(times).toBe(1);
        expect(fn.toString()).toMatch("trigger");
        await sleep(30);
        fn({ cronJob: [null, null, 30] });
      })();

      await sleep(2010);
      expect(cia.submit.mock.calls.length).toBe(1);
      await (async () => {
        const [name, times, fn] = cia.submit.mock.calls.pop();
        expect(name).toBe("Cron::test");
        expect(times).toBe(2);
        expect(fn.toString()).toMatch("trigger");
        fn({ cronJob: [Error("msg"), null, 30] });
      })();

      const stats = cron.getStats();
      expect(stats).toEqual([
        {
          name: "test",
          times: 2,
          dones: 1,
          failds: 1,
          totalMS: 30,
          avgMS: 30,
        },
      ]);
    });
  });

  describe("startAt error", () => {
    const cron = Cron(cnf, deps);
    it("case1", async () => {
      cron.regist("test", "*/2 * * * * *", "0");
      expect(cia.regist.mock.calls.length).toBe(1);
      expect(cia.regist.mock.calls.pop()).toEqual(["Cron::test", null, [{ type: "cronJob" }]]);

      expect(() => cron.start()).toThrow("startAt 定义不合法");
    });
  });
});
