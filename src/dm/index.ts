import * as _ from "lodash";

interface ModuleInterface {
  Main: (...args: any[]) => any;
  Deps?: string[] | ReadonlyArray<string>;
  Before?: (...args: any[]) => any;
  After?: (...args: any[]) => void;
}

type ModuleFn = (((...args: any[]) => any) | {}) & ModuleInterface;

/**
 * Initialize a module
 * @param Main The function is module main function
 * @param Before The function is module before hook
 * @param After The function is module after hook
 * @param _args The array is module function arguments
 * @returns Main function returns
 */
export function exec<
  Args extends any[],
  BeforeFn extends(...args: Args) => any[],
  MainFn extends (...args: ReturnType<BeforeFn>) => any,
  AfterFn extends (main: ReturnType<MainFn>, ...args: ReturnType<BeforeFn>) => void,
>(
  Main: MainFn,
  Before: BeforeFn = ((...args: Args) => args) as unknown as BeforeFn,
  After: AfterFn | undefined = undefined,
  _args: Args = [] as unknown as Args,
): ReturnType<MainFn> {
  const args = Before(..._args);
  type BeforeReturnType = ReturnType<BeforeFn>;
  const main = Main(...(args as BeforeReturnType));
  if (typeof After === "function") After(main, ...(args as BeforeReturnType));

  return main;
}

/**
 * Automatically initialize a series of modules
 * @param modules The Object that key is name of module, value is module
 * @param deps This object is used to receive the object after module initialization
 * @param args This array is used to initialize each module
 * @returns Objects after initialization of all modules merged into deps
 */
export function auto<
  Modules extends { [k in string]: ModuleFn },
  Deps extends object,
  Args extends any[],
>(modules: Modules, deps: Deps, args: Args) {
  // 获取全部即将初始化的模块名称，此时的 modules 是扁平的一级结构
  const names = new Set(Object.keys(modules));
  while (names.size) {
    // 记录此次迭代有多少个模块被排序了，如果某次迭代被排序的模块数量为0，
    // 那就要抛出异常了，说明依赖指定有问题，永远都不可能排序完毕
    let count = 0;
    /** 默认挂载函数 */
    const plugin = (name: string) => {
      const Module = modules[name] as ModuleFn;
      const Main = Module.Main;
      if (typeof Main !== "function") throw Error("Main is not a function");
      const Before = Module.Before || ((...args: any[]) => args);
      const After = Module.After;

      if (After && typeof After !== "function") throw Error("After is not a function");

      const main = exec(Main, Before, After, args);
      if (_.has(deps, name)) throw Error(`Name ${name} duplicate`);
      _.set(deps, name, main);
      names.delete(name);
      count += 1;
    };

    for (const x of names) {
      const { Deps } = modules[x];
      if (!Array.isArray(Deps) || !Deps.length) {
        plugin(x);
        continue;
      }
      if (Deps.every((d) => _.has(deps, d))) plugin(x);
    }

    if (count === 0) {
      const lacks = [];
      for (const x of names) {
        lacks.push(`${x}: ${_.filter(modules[x].Deps, (d) => !_.has(deps, d)).join(",")}`);
      }
      throw Error(`Deps defined conflict, ${lacks.join(";")}`);
    }
  }

  type TM = typeof modules;
  type M<T extends Modules> = {
    [k in keyof T]: ReturnType<T[k]["Main"]>;
  };

  return deps as M<TM> & Deps;
}
