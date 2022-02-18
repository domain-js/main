module.exports = {
  parser: "@typescript-eslint/parser", // 解析ts 代码编译器，将ts 语法树转化为 eslint 期望的
  extends: ["alloy", "alloy/typescript"],
  plugins: ["simple-import-sort", "unused-imports"],
  env: {
    // Your environments (which contains several predefined global variables)
    //
    node: true,
    commonjs: true,
    es6: true,
    jest: true,
  },
  globals: {
    // Your global variables (setting to false means it's not allowed to be reassigned)
    //
    // myGlobal: false
  },
  rules: {
    // Customize your rules
    "spaced-comment": "off", // 注释前有空白检查
    "simple-import-sort/imports": "error", // 优化import 顺序
    "simple-import-sort/exports": "error", // 优化 export 顺序
    "no-multiple-empty-lines": ["warn", { max: 2 }], // 强制最大连续空行数为 2
    complexity: ["error", 20], // https://cn.eslint.org/docs/rules/complexity
    "no-template-curly-in-string": "error", //禁止在常规字符串中出现模板字面量占位符语法
    "unused-imports/no-unused-imports": "warn",
    "@typescript-eslint/explicit-member-accessibility": "off", // 不强制设置类成员的可访问性
    "@typescript-eslint/member-ordering": "off", // 不严格限制类成员顺序
    "max-params": ["error", 6], // 函数最多6个参数
    "@typescript-eslint/no-require-imports": "off", // 部分第三方库不支持  esModuleInterop 编译选项
    "@typescript-eslint/prefer-optional-chain": "off", // 过多使用可选操作符降低代码可读性 foo?.a?.b?.c
  },
};
