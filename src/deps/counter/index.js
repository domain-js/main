function Main(cnf, deps) {
  const {
    counter: { key: REDIS_KEY },
  } = cnf;

  const { redis } = deps;

  const get = async (key) => {
    const num = await redis.hget(REDIS_KEY, key);

    return num | 0;
  };

  const set = (key, val) => redis.hset(REDIS_KEY, key, Math.max(0, val | 0));

  const incr = (key) => redis.hincrby(REDIS_KEY, key, 1);

  return { get, set, incr };
}

Main.Deps = ["redis"];

module.exports = Main;
