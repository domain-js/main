const Graceful = require("@open-node/graceful");

function Main(cnf, deps) {
  const { logger } = deps;

  return Graceful(logger.info);
}

Main.Deps = ["logger"];

module.exports = Main;
