const Schema = require("..");

describe("@domain.js/schema", () => {
  describe("auto", () => {
    const schema = Schema({});
    const errorFn = jest.fn(Error);

    it("case1", () => {
      const fn = jest.fn((x) => x);
      const fn1 = schema.auto(fn, [{ type: "string" }], errorFn, { foo: "bar" });
      expect(fn1("hello")).toBe("hello");

      expect(() => fn1(["hello"])).toThrow("1");
      expect(errorFn.mock.calls.length).toBe(1);
      expect(errorFn.mock.calls.pop()).toEqual([
        1,
        [
          {
            dataPath: "",
            keyword: "type",
            message: "should be string",
            params: { type: "string" },
            schemaPath: "#/type",
          },
        ],
        ["hello"],
        { foo: "bar" },
      ]);
    });

    it("case2, schemas type isnt array", () => {
      const fn = jest.fn((x) => x);
      expect(() => schema.auto(fn, { type: "string" }, errorFn, { foo: "bar" })).toThrow("参数");
    });
  });

  describe("validate", () => {
    const schema = Schema({});

    it("case1", () => {
      expect(schema.validate({ type: "string" }, "hello")).toBe(true);
      expect(schema.validate({ type: "string" }, "")).toBe(true);
      expect(() => schema.validate({ type: "string" }, 123)).toThrow();
      expect(() => schema.validate({ type: "string" })).toThrow();
    });

    it("case2, format", () => {
      expect(schema.validate({ type: "string", format: "url" }, "https://xiongfei.me/")).toBe(true);
      expect(() => schema.validate({ type: "string", format: "url" }, "123")).toThrow();
    });
  });

  describe("coerceTypes is true", () => {
    const schema = Schema({ schema: { coerceTypes: true } });
    it("case1", () => {
      expect(schema.validate({ type: "integer" }, "1")).toBe(true);
      const data = { age: "20" };
      expect(
        schema.validate({ type: "object", properties: { age: { type: "integer" } } }, data),
      ).toBe(true);
      expect(data).toEqual({ age: 20 });
    });
  });

  describe("useDefaults is true", () => {
    const schema = Schema({ schema: { coerceTypes: true, useDefaults: true } });
    it("case1", () => {
      expect(schema.validate({ type: "integer" }, "1")).toBe(true);
      const data = { age: "20" };
      expect(
        schema.validate(
          {
            type: "object",
            properties: {
              age: { type: "integer" },
              name: { type: "string", maxLength: 20, default: "Tom" },
            },
          },
          data,
        ),
      ).toBe(true);
      expect(data).toEqual({ age: 20, name: "Tom" });
    });
  });

  describe("removeAdditional is true", () => {
    const schema = Schema({ schema: { removeAdditional: true } });
    const data = { age: 20, gender: "female" };
    it("case1", () => {
      expect(
        schema.validate(
          {
            type: "object",
            additionalProperties: false,
            properties: {
              age: { type: "integer" },
              name: { type: "string", maxLength: 20, default: "Tom" },
            },
          },
          data,
        ),
      ).toBe(true);
      expect(data).toEqual({ age: 20 });
    });
  });

  describe("union types", () => {
    const schema = Schema({});
    const data = { age: "20" };
    it("case1", () => {
      const schm = {
        type: "object",
        properties: {
          age: {
            anyOf: [{ type: "integer" }, { type: "string" }, { type: "null" }],
          },
        },
      };
      expect(schema.validate(schm, data)).toBe(true);
      expect(schema.validate(schm, { age: "tweety" })).toBe(true);
      expect(schema.validate(schm, { age: null })).toBe(true);
      expect(schema.validate(schm, { age: 20 })).toBe(true);
    });
  });

  describe("compile", () => {
    const schema = Schema({});
    const data = { age: 20 };
    it("case1", () => {
      const schm = {
        type: "object",
        properties: {
          age: {
            type: "string",
          },
        },
      };
      const validator = schema.compile(schm);
      expect(validator(data)).toBe(false);
      expect(validator({ age: "tweety" })).toBe(true);
      expect(validator({ age: null })).toBe(false);
      expect(validator({ age: 20 })).toBe(false);
    });
  });
});
