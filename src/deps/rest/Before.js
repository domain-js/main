const Utils = require("./utils");

module.exports = (cnf, deps) => {
  const utils = Utils(cnf, deps);

  return [cnf, deps, utils];
};
