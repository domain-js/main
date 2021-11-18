function Main(cnf, deps, _name, time) {
  const sayHi = () => "hi from two";
  console.log(`I am after hook, ${_name} at: ${time}`);

  return { sayHi };
}

Main.Deps = ["three"]; // 这个会导致循环依赖

module.exports = Main;
