import * as cronParser from "cron-parser";
import human = require("human-interval");

interface Cnf {
  cron?: {
    tz?: string;
  };
}

interface waiter {
  type: string;
  timeout?: number;
  validator?: any;
}

interface callbackArg {
  cronJob: [Error | null, any, number];
}

interface Deps {
  cronParser: typeof cronParser;
  humanInterval: typeof human;
  myCia: {
    regist: (name: string, validator: any, waiters: waiter[]) => void;
    submit: (name: string, times: number, callback: (arg: callbackArg) => void) => void;
  };
}

interface Registed {
  [propName: string]: {
    times: number; // 触发多少次
    dones: number; // 执行成功多少次
    failds: number; // 失败次数
    totalMS: number; // 执行总共消耗的时间(毫秒)
    triggeredAt: number;
    intervalStr: string;
    startAt?: string;
  };
}

/**
 * 定时执行函数, 解决 setTimeout 第二个参数不能大于 2147483647 的问题
 * @param fn 要执行的函数
 * @param timeoutMS 执行间隔时间，单位毫秒
 */
export const timeout = (fn: Function, timeoutMS: number) => {
  if (timeoutMS < 2147483647) {
    setTimeout(fn, timeoutMS);
  } else {
    setTimeout(() => {
      timeout(fn, timeoutMS - 2147483647);
    }, 2147483647);
  }
};

export function Main(cnf: Cnf, deps: Deps) {
  const { cron = {} } = cnf;

  const ciaTaskType = "cronJob";
  const { myCia, humanInterval: human, cronParser: parser } = deps;
  const { tz = "Asia/Shanghai" } = cron;

  // 注册信息
  const registed: Registed = {};

  // 是否已经启动, 记录的是启动时间
  let startedAt: Date;

  // 计算具体下次执行还有多少毫秒
  const calcNextMS = (intervalStr: string) => {
    const interval = human(intervalStr) || parser.parseExpression(intervalStr, { tz });
    if (typeof interval === "number") return interval;

    //  *    *    *    *    *    *
    //  ┬    ┬    ┬    ┬    ┬    ┬
    //  │    │    │    │    │    |
    //  │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
    //  │    │    │    │    └───── month (1 - 12)
    //  │    │    │    └────────── day of month (1 - 31, L)
    //  │    │    └─────────────── hour (0 - 23)
    //  │    └──────────────────── minute (0 - 59)
    //  └───────────────────────── second (0 - 59, optional)
    return interval.next().getTime() - Date.now();
  };

  // 触发
  const trigger = (name: string) => {
    const opt = registed[name];

    let timeoutMS = calcNextMS(opt.intervalStr);
    if (opt.times === 0 && opt.startAt) {
      // 第一次
      const startAt = human(opt.startAt);
      if (!startAt) throw Error("startAt 定义不合法");
      timeoutMS = startAt;
    }
    timeout(() => {
      opt.times += 1;
      opt.triggeredAt = Date.now();
      myCia.submit(`Cron::${name}`, opt.times, ({ cronJob: [err, , totalMS] }) => {
        if (err) {
          opt.failds += 1;
        } else {
          opt.dones += 1;
          opt.totalMS += totalMS;
        }
        trigger(name);
      });
    }, timeoutMS);
  };

  // name string 任务名称
  // interval string | number 任务执行间隔
  // startAt string 任务开始于
  const regist = (name: string, intervalStr: string, startAt?: string) => {
    if (startedAt) throw Error("计划任务系统已经启动，禁止注册");
    if (registed[name]) throw Error(`Same name cron has been registed: ${name}`);

    // 写入到注册变量上去。后续持续执行需要用到
    registed[name] = {
      times: 0,
      dones: 0,
      failds: 0,
      totalMS: 0,
      triggeredAt: 0,
      intervalStr,
      startAt,
    };

    // 注册到cia上, 为了借助cia的能力自动下发任务
    // 增加 Cron:: 前缀是为了避免和其他任务名称冲突
    myCia.regist(`Cron::${name}`, null, [{ type: ciaTaskType }]);
  };

  const start = () => {
    if (startedAt) throw Error("已经启动，不能重复启动");
    startedAt = new Date();
    for (const name of Object.keys(registed)) trigger(name);
  };

  const getStats = () => {
    const stats = [];
    for (const name of Object.keys(registed)) {
      const { times, dones, failds, totalMS } = registed[name];
      const avgMS = dones ? totalMS / dones : null;

      stats.push({ name, times, dones, failds, totalMS, avgMS });
    }

    return stats;
  };

  return { regist, start, getStats };
}

export const Deps = ["myCia", "humanInterval", "cronParser"];
