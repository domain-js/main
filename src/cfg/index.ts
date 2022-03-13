import Ajv, { Schema } from "ajv";
import addFormats from "ajv-formats";
import _ from "lodash";

interface Cnf {
  [propName: string]: string | undefined;
}

export function Main(object: Cnf, schema: Schema) {
  if (typeof schema !== "object") throw Error("object type isnt an object");
  const FIELDS = new Set(Object.keys(schema.properties));
  const ajv = new Ajv({ allowUnionTypes: true, coerceTypes: true, useDefaults: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const obj = _.pick(object, [...FIELDS]);
  if (!validate(obj)) {
    console.log("Config object data validate failed", obj);
    console.log(JSON.stringify(validate.errors, null, 2));
    throw Error("Config object data has error");
  }

  return (key: string) => {
    if (!FIELDS.has(key)) throw Error(`Key: ${key} 未提前在 schema 中定义, 请先定义`);

    return obj[key];
  };
}
