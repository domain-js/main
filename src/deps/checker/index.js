function Main(cnf, deps) {
  const { errors, async } = deps;

  /** 检测两个值是否相等 */
  const equal = (v1, v2) => v1 === v2;

  /** 判断判断，一次执行数组里的函数 遇到成功的立刻停止，否则抛出信息 */
  const PRIVACY_DEFAULT_ERROR = errors.notAllowed("权限不足");
  const privacy = async (fns, error = PRIVACY_DEFAULT_ERROR) => {
    const passed = await async.someSeries(fns, async ([fn, ...args]) => {
      const ret = await fn(...args);
      return ret;
    });

    if (!passed) throw error;
  };

  return {
    equal,
    privacy,
  };
}

Main.Deps = ["async", "errors"];

module.exports = Main;
