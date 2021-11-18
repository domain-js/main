module.exports = (cnf, deps) => {
  const now = Date.now();
  return [cnf, deps, "this is one", now];
};
