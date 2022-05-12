#! /usr/bin/env node

import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  prompt: "> ",
  removeHistoryDuplicates: true,
});
rl.setPrompt("> ");

const _require = require;

const showMessage = (msg: string, exit?: number) => {
  rl.write(`${msg}\n`);
  if (exit) process.exit(exit);
  rl.setPrompt("> ");
};

const file2Module = (file: string) => file.replace(/(-\w)/g, (m) => m[1].toUpperCase());
const filePath2Var = (_path: string) => file2Module(_path.replace(/[/.]+/g, "-"));
const codeStyleFormat = (targetFile: string) =>
  new Promise((resolve: Function, reject: Function) => {
    exec(`prettier -w ${targetFile} && eslint --fix ${targetFile}`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

const makeDefineFile = async (modules: any[], targetFile: string, isTS: boolean) => {
  const dirname = path.dirname(targetFile);
  const content = ["// domain-cli 自动生成"];
  const _exports = [];
  for (const x of modules) {
    const name = path.relative(dirname, x);
    const variable = filePath2Var(name);

    if (isTS) {
      content.push(`import * as ${variable} from "./${name}";`);
    } else {
      content.push(`const ${variable} = require("./${name}");`);
    }
    _exports.push(`"${file2Module(name).replace(/[/]/, ".")}": ${variable},`);
  }

  // 处理导出
  content.push("\n");
  if (isTS) {
    content.push("export = {");
  } else {
    content.push("module.exports = {");
  }

  for (const x of _exports) content.push(`  ${x}`);
  content.push("};");

  fs.writeFileSync(targetFile, content.join("\n"));
  await codeStyleFormat(targetFile);

  console.log(`Completed: ${targetFile}`);
};

const checkHookExport = (_dir: string) => {
  for (const hook of ["Before", "After"]) {
    const TSFile = path.resolve(_dir, `${hook}.ts`);
    const JSFile = path.resolve(_dir, `${hook}.js`);

    const Main = _require(_dir);
    if (fs.existsSync(JSFile)) {
      const Hook = _require(JSFile);
      if (Main[hook] !== Hook) throw Error(`${hook} 定义和 export 不一致 ${_dir}`);
    }

    if (fs.existsSync(TSFile)) {
      const { [hook]: Hook } = _require(TSFile);
      if (Main[hook] !== Hook) throw Error(`${hook} 定义和 export 不一致 ${_dir}`);
    }
  }
};

const loadDeps = async (rootDir: string, ext = "js") => {
  const isTS = ext === "ts";
  const modules = [];
  const dir = path.resolve(rootDir, "./");
  for (const x of fs.readdirSync(dir)) {
    // 忽略隐藏目录
    if (x[0] === ".") continue;
    const _dir = path.resolve(dir, x);
    const stat = fs.statSync(_dir);

    // 非目录忽略，模块必须是目录
    if (!stat.isDirectory()) continue;
    checkHookExport(_dir);

    modules.push(path.join(dir, x));
  }

  // 按字典排序，后续有变动的时候不容易冲突
  const targetFile = path.resolve(rootDir, `./defines.${ext}`);
  await makeDefineFile(modules.sort(), targetFile, isTS);
};

/**
 * 自动加载领域方法
 * @param rootDir 项目根目录
 * @param ext 文件后缀
 */
const loadDomain = async (rootDir = process.cwd(), ext = "js") => {
  const isTS = ext === "ts";
  const modules = [];
  const dir = path.resolve(rootDir, "src/domain/services/");
  for (const domain of fs.readdirSync(dir)) {
    // 忽略隐藏目录, 忽略私有目录
    if (domain[0] === "." || domain[0] === "_") continue;
    const _dir = path.resolve(dir, domain);
    const stat = fs.statSync(_dir);

    // 非目录忽略，模块必须是目录
    if (!stat.isDirectory()) continue;

    for (const name of fs.readdirSync(_dir)) {
      // 忽略隐藏目录, 忽略私有目录
      if (name[0] === "." || name[0] === "_") continue;
      const extname = path.extname(name);
      if (extname.toLowerCase() !== `.${ext}`) continue;
      modules.push(path.join(dir, domain, path.basename(name, extname)));
    }
  }

  // 按字典排序，后续有变动的时候不容易冲突
  const targetFile = path.resolve(rootDir, `src/domain/services/defines.${ext}`);
  await makeDefineFile(modules.sort(), targetFile, isTS);
};

/**
 * 尝试读取目录下的文件
 * @param dir 目录路径
 * @param list 读取到schema后压入改列表
 */
const tryReadSchemas = (dir: string, list: string[], isTS = false) => {
  if (!fs.existsSync(dir)) return;
  const stat = fs.statSync(dir);
  if (stat.isFile()) return;
  for (const x of fs.readdirSync(dir)) {
    if (x.startsWith(".")) continue;
    const ext = path.extname(x);
    if (isTS && ext !== ".ts") continue;
    if (!isTS && ext !== ".js") continue;
    list.push(path.join(dir, path.basename(x, isTS ? ".ts" : ".js")));
  }
};

const loadSchemas = async (rootDir = process.cwd(), ext = "js") => {
  const isTS = ext === "ts";
  const modules: string[] = [];
  const dir = path.resolve(rootDir, "src/domain/services/");
  for (const x of fs.readdirSync(dir)) {
    // 忽略隐藏目录, 忽略私有目录
    if (x[0] === "." || x[0] === "_") continue;
    const _dir = path.resolve(dir, x);
    const stat = fs.statSync(_dir);

    // 非目录忽略，模块必须是目录
    if (!stat.isDirectory()) continue;

    // 尝试读取子目录里的 schemas 目录
    tryReadSchemas(path.join(_dir, "schemas"), modules, isTS);
  }

  // 按字典排序，后续有变动的时候不容易冲突
  const targetFile = path.resolve(rootDir, `src/domain/services/schemas.${ext}`);
  await makeDefineFile(modules.sort(), targetFile, isTS);
};

const actions = { loadDeps, loadSchemas, loadDomain };

const main = async (command: "loadDeps" | "loadSchemas" | "loadDomain") => {
  const action = actions[command];
  if (!action) {
    const msg = `${action} 不存在该指令，只支持 ${Object.keys(actions)}`;
    return showMessage(msg, 0);
  }
  try {
    await (action as Function)(...process.argv.slice(3));
  } catch (e) {
    showMessage(e instanceof Error ? e.message : (e as string), 1);
  }
  return process.exit(0);
};

main(process.argv[2] as any);

process.on("uncaughtException", (error) => {
  console.error("[%s]: uncaughtException", new Date());
  console.error(error);
});

process.on("unhandledRejection", (reason, p) => {
  console.error("[%s]: unhandledRejection", new Date());
  console.error(reason, p);
});

process.on("rejectionHandled", (error) => {
  console.error("[%s]: rejectionHandled", new Date());
  console.error(error);
});
