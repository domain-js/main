const Before = require("./Before");
const After = require("./After");

const Main = () => ({
  sayHi() {
    return "hi from one";
  },
});

Main.Before = Before;
Main.After = After;

module.exports = Main;
