import * as _ from "lodash";
import * as DM from "./dm";

import Deps = require("./deps/defines");

export { Main as Http } from "./http";
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
  /** 模块名称联合类型 */
  type MS = RemoveReadonlyArray<T>;
  type Cnf = Merge<
    TDeps[Include<keyof TDeps, MS>]["Main"] extends (arg: infer R, ...args: any[]) => any ? R : {}
  >;

  return (cnf: Cnf) => {
    const deps = {};

    const modules = DM.auto(_.pick(Deps, features) as Pick<TDeps, MS>, deps, [cnf, deps]);
    return modules;
  };
}
