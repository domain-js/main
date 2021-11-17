const util = require("util");
const Ajv = require("ajv").default;
const addFormats = require("ajv-formats").default;

function Main(cnf) {
  const ajv = new Ajv(cnf.schema);
  addFormats(ajv);

  const compile = (schema) => ajv.compile(schema);

  /**
   * 将函数处理为自动校验参数合法性
   */
  const auto = (fn, schema, errorFn, extra) => {
    if (!Array.isArray(schema)) {
      throw Error(`方法参数定义必须是一个数组 ${util.format(schema)}`);
    }
    const validators = schema.map((x) => compile(x));

    return (...args) => {
      for (let i = 0; i < schema.length; i += 1) {
        const valid = validators[i](args[i]);
        if (!valid) {
          throw errorFn(i + 1, validators[i].errors, args[i], extra);
        }
      }
      return fn(...args);
    };
  };

  /**
   * 检测数据是否符合 schema 设定
   */
  const validate = (schema, data) => {
    if (ajv.validate(schema, data)) return true;
    throw ajv.errors;
  };

  return Object.freeze({ auto, validate, compile, ajv });
}

Main.Deps = [];

module.exports = Main;
