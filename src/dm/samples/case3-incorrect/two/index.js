function Main() {
  const sayHi = () => "hi from two";

  return { sayHi };
}

Main.Deps = ["one"];

module.exports = Main;
