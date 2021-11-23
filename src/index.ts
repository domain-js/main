import * as DM from "./dm";
import Deps = require("./deps/defines");

export { Main as Http } from "./http";
export * as DM from "./dm";
export * as utils from "./utils";

type TDeps = typeof Deps;
type Merge<T> = {
  [k in keyof T]: T[k];
};

type Cnf = Merge<TDeps[keyof TDeps]["Main"] extends (arg: infer R, ...args: any[]) => any ? R : {}>;
type Deps = {};

export function Main(cnf: Cnf) {
  const deps = {};
  const modules = DM.auto(Deps, deps, [cnf, deps]);
  return modules;
}
