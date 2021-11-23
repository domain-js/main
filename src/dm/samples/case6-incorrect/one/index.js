const Before = require("./Before");
const After = require("./After");

const Main = () => ({
  sayHi() {
    return "hi from one";
  },
});

module.exports = { Main, Before, After };
