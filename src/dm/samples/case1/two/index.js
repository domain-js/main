function Main(cnf, deps, _name, time) {
  const sayHi = () => "hi from two";
  console.log(`I am after hook, ${_name} at: ${time}`);

  return { sayHi };
}

module.exports = Main;
