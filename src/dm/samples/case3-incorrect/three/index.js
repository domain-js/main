function Main(cnf, deps, _name, time) {
  const sayHi = () => "hi from three";
  console.log(`I am Main, ${_name} at: ${time}`);

  return { sayHi };
}

Main.Deps = ["two"];

module.exports = Main;
