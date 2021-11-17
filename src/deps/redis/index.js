const Redis = require("ioredis");

function Main(cnf) {
  const { redis } = cnf;

  return new Redis(redis);
}

module.exports = Main;
