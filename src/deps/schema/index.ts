import * as ajv from "ajv";
import addFormats from "ajv-formats";
import ajvKeywords from "ajv-keywords";
import * as util from "util";

interface Cnf {
  schema?: ConstructorParameters<typeof ajv.default>[0];
}

interface Deps {
  ajv: {
    default: typeof ajv.default;
  };
  ajvFormats: typeof addFormats;
  ajvKeywords: typeof ajvKeywords;
}

type Schema = ajv.Schema;

/**
 * JSON schema validation module, based on Ajv: https://www.npmjs.com/package/ajv
 * @param cnf Ajv initialization parameters
 * @returns auto, validate, complie, ajv
 */
export function Main(cnf: Cnf, deps: Deps) {
  const {
    ajv: { default: Ajv },
    ajvFormats,
    ajvKeywords,
  } = deps;
  const ajv = new Ajv(cnf.schema || {});
  ajvFormats(ajv);
  ajvKeywords(ajv);

  /**
   * Ajv complie function
   * @param schema Definition of data format, Ajv specification
   * @returns Verification function
   */
  const compile = (schema: Schema) => ajv.compile(schema);

  /**
   * Automatically process functions as functions with parameter validate
   * @param fn Function to be processed
   * @param schema Format definition of function parameters, Ajv specification
   * @param errorFn Error handling function
   * @param extra Additional information passed to the error function
   * @returns Processed function
   */
  function auto<F extends (...args: any[]) => any>(
    fn: F,
    schema: Schema[],
    errorFn: Function,
    extra: any,
  ) {
    if (!Array.isArray(schema)) {
      throw Error(`Method arguments must be an array: ${util.format(schema)}`);
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
   * Verification functoin
   * @param schema Definition of data format, Ajv specification
   * @param data Data to be verified
   * @returns ture or throw ajv.errors
   */
  const validate = (schema: Schema, data: any) => {
    if (ajv.validate(schema, data)) return true;
    throw ajv.errors;
  };

  return Object.freeze({
    auto,
    validate,
    compile,
    /** instance of Ajv */
    ajv,
  });
}

export const Deps = ["ajv", "ajvFormats", "ajvKeywords"];
