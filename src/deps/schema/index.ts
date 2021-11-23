import * as util from "util";
import Ajv, { Schema } from "ajv";
import addFormats from "ajv-formats";

interface Cnf {
  schema?: ConstructorParameters<typeof Ajv>[0];
}

export function Main(cnf: Cnf) {
  const ajv = new Ajv(cnf.schema || {});
  addFormats(ajv);

  const compile = (x: Schema) => ajv.compile(x);

  /**
   * 将函数处理为自动校验参数合法性
   */
  function auto<F extends(...args: any[]) => any>(
    fn: F,
    schema: Schema[],
    errorFn: Function,
    extra: any,
  ) {
    if (!Array.isArray(schema)) {
      throw Error(`方法参数定义必须是一个数组 ${util.format(schema)}`);
    }
    const validators = schema.map((x: Schema) => ajv.compile(x));

    return (...args: Parameters<F>): ReturnType<F> => {
      for (let i = 0; i < schema.length; i += 1) {
        const valid = validators[i](args[i]);
        if (!valid) {
          throw errorFn(i + 1, validators[i].errors, args[i], extra);
        }
      }
      return fn(...args);
    };
  }

  /**
   * 检测数据是否符合 schema 设定
   */
  const validate = (schema: Schema, data: any) => {
    if (ajv.validate(schema, data)) return true;
    throw ajv.errors;
  };

  return Object.freeze({ auto, validate, compile, ajv });
}
