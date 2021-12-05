import { defaults, Defaults } from "./defaults";
import * as DM from "./dm";
import Deps = require("./deps/defines");

export { Main as Http } from "./http";
export { Errors } from "./Errors/index";
export * as DM from "./dm";
export * as utils from "./utils";

type TDeps = typeof Deps;
type Merge<T> = {
  [k in keyof T]: T[k];
};

/**
 * Include from T those types that are assignable to U
 */
type Include<T, U> = T extends U ? T : never;
type RemoveReadonlyArray<T> = T extends ReadonlyArray<infer T1> ? T1 : false;

export function Main<T extends Readonly<Array<keyof TDeps>>>(features: T) {
  const { _ } = defaults;
  /** 模块名称联合类型 */
  type MS = RemoveReadonlyArray<T>;
  type Cnf = Merge<
    TDeps[Include<keyof TDeps, MS>]["Main"] extends (arg: infer R, ...args: any[]) => any ? R : {}
  >;

  return (cnf: Cnf) => {
    /** 这里之所以要浅拷贝，是为了避免多次初始化之间互相干扰 */
    const _deps = { ...defaults } as Defaults;
    const modules = DM.auto(
      _.pick(Deps, features) as Pick<TDeps, MS> /** 要启用的内部模块 */,
      _deps /** 初始的模块依赖对象 */,
      [cnf, _deps] /** 内部模块初始化参数 */,
    );

    return modules;
  };
}
