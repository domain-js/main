const async = require("async");
const Redis = require("ioredis");
const Parallel = require("..");

const cnf = {
  parallel: {
    key: "TP",
    defaultErrorFn: console.error,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const redis = new Redis();
const graceful = {
  exit(fn) {
    console.log(fn);
  },
};

const deps = {
  async,
  logger: console,
  graceful,
  U: { sleep },
  redis,
};

const obj = {
  fn1() {
    return new Promise((resolve, reject) => {
      console.log("running start at: %s", new Date());
      setTimeout(() => {
        resolve(Date.now());
      }, 1000 * 1000);
    });
  },
};

(async () => {
  const parallel = Parallel(cnf, deps);
  obj.fn1 = parallel(obj.fn1, {
    path: "case1",
    needWaitMS: 15 * 1000,
  });

  setInterval(() => {
    obj.fn1();
  }, 10 * 1000);
})();
