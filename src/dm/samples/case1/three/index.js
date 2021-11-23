function Main(cnf, deps, _name, time) {
  const sayHi = () => "hi from three";
  console.log(`I am after hook, ${_name} at: ${time}`);

  return { sayHi };
}

const Deps = ["two"];

module.exports = { Main, Deps };
