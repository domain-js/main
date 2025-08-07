import _ from "lodash";

import { Defaults, defaults } from "./defaults";
import * as DM from "./dm";
import Deps = require("./deps/defines");

// 显式导入 cache 模块的类型定义
import type { CnfDef as CacheCnfDef } from "./deps/cache";

export { Main as Cfg } from "./cfg";
export * as DM from "./dm";
export { Errors } from "./Errors";
export { Main as Http } from "./http";
export * as utils from "./utils";
export const basicErrors = defaults.errors;

type TDeps = typeof Deps;

/**
 * 获取模块配置类型
 */
type ModuleConfig<T extends keyof TDeps> = T extends "cache"
  ? CacheCnfDef
  : TDeps[T]["Main"] extends (arg: infer R, ...args: any[]) => any
    ? R
    : {};

/**
 * 获取模块返回类型
 */
type ModuleReturn<T extends keyof TDeps> = ReturnType<TDeps[T]["Main"]>;

/**
 * 合并多个模块的配置类型（可选）
 */
type MergeConfigs<T extends readonly (keyof TDeps)[]> = {
  [K in T[number]]?: ModuleConfig<K>;
};

/**
 * 合并多个模块的返回类型
 */
type MergeReturns<T extends readonly (keyof TDeps)[]> = {
  [K in T[number]]: ModuleReturn<K>;
};

export function Main<T extends readonly (keyof TDeps)[]>(features: T) {
  return (cnf: MergeConfigs<T> = {} as MergeConfigs<T>) => {
    /** 这里之所以要浅拷贝，是为了避免多次初始化之间互相干扰 */
    const _deps: Defaults = { ...defaults };
    const modules = DM.auto(
      _.pick(Deps, features) as Pick<TDeps, T[number]> /** 要启用的内部模块 */,
      _deps /** 初始的模块依赖对象 */,
      [cnf, _deps] /** 内部模块初始化参数 */,
    );

    return modules as MergeReturns<T> & Defaults;
  };
}
