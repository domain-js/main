/** 将 readonly string[] 转换成联合类型 */
export type ReadonlyArray2union<T extends ReadonlyArray<any>> = T extends ReadonlyArray<infer A>
  ? A
  : never;

type Type = "string" | "number" | "integer" | "object" | "array" | "boolean" | "null";

/** 接口参数 schema 定义的类型 */
export interface ParamsSchema<
  Params extends {},
  Keys extends string | number | symbol = keyof Params,
> {
  /** 接口整体描述信息 */
  description: string;
  /** 固定为 object params 必然是一个对象, 可以是一个空对象 */
  type: "object";
  /** 必填选项  */
  required?: (keyof Params)[];
  /** 多选1的设定 */
  oneOf?: any[];
  /** 是否允许添加额外的属性 */
  additionalProperties?: boolean;
  /** params 参数每一个属性的描述 */
  properties: Record<
    Keys,
    Record<string, any> & {
      /** 当前参数的描述信息 */
      description: string;
      /** 当前参数的类型 */
      type: Type | Type[] | readonly Type[];
    }
  >;
}
