const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");
const prettier = require("eslint-plugin-prettier");
const simpleImportSort = require("eslint-plugin-simple-import-sort");
const unusedImports = require("eslint-plugin-unused-imports");

module.exports = [
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    ignores: [
      "src/**/__test__/**/*.ts",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "dist/**/*",
      "node_modules/**/*",
      "coverage/**/*",
      ".git/**/*",
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        // Node.js 环境全局变量
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        // Jest 环境全局变量
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        jest: "readonly",
        // 浏览器和Node.js全局变量
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      prettier: prettier,
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      // 自定义规则
      "spaced-comment": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-multiple-empty-lines": ["warn", { max: 2 }],
      complexity: ["error", 20],
      "no-template-curly-in-string": "error",
      "unused-imports/no-unused-imports": "warn",
      "@typescript-eslint/explicit-member-accessibility": "off",
      "@typescript-eslint/member-ordering": "off",
      "max-params": ["error", 6],
      "max-nested-callbacks": ["error", 5],
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "prettier/prettier": "error",

      // 处理未使用变量的规则
      "no-unused-vars": "off", // 关闭基础规则
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          args: "after-used",
          ignoreRestSiblings: true,
        },
      ],

      // 处理重复声明的规则 - 完全关闭，让TypeScript处理
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "off",

      // 处理未定义变量的规则
      "no-undef": "off", // 关闭基础规则，让TypeScript处理

      // 关闭一些过于严格的规则
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  // 添加一个全局忽略配置
  {
    ignores: [
      "**/__test__/**",
      "**/*.test.ts",
      "**/*.spec.ts",
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".git/**",
    ],
  },
];
