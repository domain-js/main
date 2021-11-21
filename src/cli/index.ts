#! /usr/bin/env ts-node

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { exec } from "child_process";

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
  if (exit != null) process.exit(exit);
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
  const content = ["// domain-cli 自动生成"];
  const _exports = [];
  for (let i = 0; i < modules.length; i += 1) {
    const name = modules[i];
    const variable = filePath2Var(name);

    if (isTS) {
      content.push(`import * as ${variable} from "./${name}"`);
    } else {
      content.push(`const ${variable} = require("./${name}")`);
    }
    _exports.push(`"${file2Module(name)}": ${variable},`);
  }

  // 处理导出
  content.push("\n");
  if (isTS) {
    content.push("export = {");
  } else {
    content.push("module.exports = {");
  }

  for (const x of _exports) content.push(x);
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

const loadDeps = async (rootDir = process.cwd(), ext = "js") => {
  const isTS = ext === "ts";
  const modules = [];
  const dir = path.resolve(rootDir, "src/deps/");
  for (const x of fs.readdirSync(dir)) {
    // 忽略隐藏目录
    if (x[0] === ".") continue;
    const _dir = path.resolve(dir, x);
    const stat = fs.statSync(_dir);

    // 非目录忽略，模块必须是目录
    if (!stat.isDirectory()) continue;
    checkHookExport(_dir);

    modules.push(x);
  }

  // 按字典排序，后续有变动的时候不容易冲突
  const targetFile = path.resolve(rootDir, `src/deps/defines.${ext}`);
  await makeDefineFile(modules.sort(), targetFile, isTS);
};

const checkService = (_dir: string) => {
  const TSFile = path.resolve(_dir, "index.ts");
  const JSFile = path.resolve(_dir, "index.js");

  if (!fs.existsSync(TSFile) && !fs.existsSync(JSFile)) {
    throw Error("目录下缺少index.ts 或 index.js 文件");
  }
};

const loadServices = async (rootDir = process.cwd(), ext = "js") => {
  const isTS = ext === "ts";
  const modules = [];
  const dir = path.resolve(rootDir, "src/services/");
  for (const x of fs.readdirSync(dir)) {
    // 忽略隐藏目录, 忽略私有目录
    if (x[0] === "." || x[0] === "_") continue;
    const _dir = path.resolve(dir, x);
    const stat = fs.statSync(_dir);

    // 非目录忽略，模块必须是目录
    if (!stat.isDirectory()) continue;
    checkService(_dir);

    modules.push(x);
  }

  // 按字典排序，后续有变动的时候不容易冲突
  const targetFile = path.resolve(rootDir, `src/services/defines.${ext}`);
  await makeDefineFile(modules.sort(), targetFile, isTS);
};

interface DeepModules {
  [propName: string]: string | DeepModules;
}

const deepLoadDir = (root: string, parent: string, files: string[] = []) => {
  const paths: DeepModules = {};
  const dir = path.resolve(root, parent);
  for (const x of fs.readdirSync(dir)) {
    // 忽略隐藏目录
    if (x[0] === ".") continue;
    const file = path.resolve(dir, x);
    const stat = fs.statSync(file);

    const { name, ext } = path.parse(x);
    const relativeFilePath = `./${path.join(parent, name)}`;
    const moduleName = file2Module(name);
    // 如果是文件则记录
    if (stat.isFile()) {
      if (ext === ".ts") {
        const JSFile = path.resolve(dir, `${name}.js`);
        // 对应的js文件存在，则ts文件忽略
        if (fs.existsSync(JSFile)) continue;
        // 对应的js文件不存在，抛出异常提示用户要先编译
        throw Error(`请先编译ts文件: ${file}`);
      }
      files.push(relativeFilePath);
      paths[moduleName] = relativeFilePath;
      continue;
    }

    if (stat.isDirectory()) {
      paths[moduleName] = deepLoadDir(root, relativeFilePath, files);
    }
  }

  return paths;
};

const deepLoadModule = async (rootDir: string, targetFile: string) => {
  const files: string[] = [];
  const paths = deepLoadDir(rootDir, "./", files);
  const { ext } = path.parse(targetFile);

  // 按字典排序，后续有变动的时候不容易冲突
  files.sort();

  const relative = path.relative(path.dirname(targetFile), rootDir);
  const isTS = ext === ".ts";
  const content = ["// domain-cli 自动生成"];
  for (let i = 0; i < files.length; i += 1) {
    const name = files[i];
    const _path = `./${path.join(relative, name)}`;
    const variable = filePath2Var(name);
    if (isTS) {
      content.push(`import * as ${variable} from "${_path}"`);
    } else {
      content.push(`const ${variable} = require("${_path}")`);
    }
  }

  // 处理导出
  content.push("\n");
  let _exports = JSON.stringify(paths, null, 2);
  for (let i = 0; i < files.length; i += 1) {
    _exports = _exports.replace(`"${files[i]}"`, filePath2Var(files[i]));
  }
  if (isTS) {
    content.push(`export = ${_exports}`);
  } else {
    content.push(`module.exports = ${_exports}`);
  }

  fs.writeFileSync(targetFile, content.join("\n"));
  await codeStyleFormat(targetFile);

  console.log(`Completed: ${targetFile}`);
};

const actions = { loadDeps, loadServices, deepLoadModule };

const main = async (command: "loadDeps" | "loadServices" | "deepLoadModule") => {
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
