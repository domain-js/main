function After(main, cnf, deps, name, time) {
  console.log(`I am after hook, ${name} at: ${time}`);
}

module.exports = After;
