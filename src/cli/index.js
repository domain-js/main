#! /usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { exec } = require("child_process");
const async = require("async");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  prompt: "> ",
  removeHistoryDuplicates: true,
});
rl.setPrompt("> ");

const _require = require;

const confirm = async (question) =>
  new Promise((resolve) => {
    rl.question(`${question} [Yes/no]: `, (ans) => resolve(ans.toLowerCase() !== "no"));
    rl.setPrompt("> ");
  });

const getAnswers = async (questions) => {
  const data = {};

  await async.eachSeries(questions, async ([question, key, defaultValue]) => {
    data[key] = await new Promise((resolve) => {
      const msg = [`${question}[${key}]:`];
      if (defaultValue != null) msg.push(`Default: ${defaultValue}`);
      rl.question(`${msg.join("\n")} `, resolve);
    });

    if (defaultValue != null && !data[key]) data[key] = defaultValue;
  });

  return data;
};

const showMessage = (msg, exit) => {
  rl.output.write(`${msg}\n`);
  if (exit != null) process.exit(exit);
  rl.setPrompt("> ");
};

const init = async () => {
  showMessage("初始化一个新的 domain.js 项目的 domain 模块");
  const questions = [["输入项目路径", "dir"]];
  const data = await getAnswers(questions);
  const ok = await confirm(`确定创建在 ${data.dir || "当前"} 目录吗?`);
  if (!ok) return init();

  const commands = [
    `git clone 'https://github.com/domain-js/domain-boilerplate.git' ${data.dir}`,
    `cd ${data.dir}`,
    `rm -rf ${data.dir}./.git`,
  ].join(" && ");

  showMessage("------ The following command will be executed ------");
  showMessage(commands);

  return new Promise((resolve, reject) => {
    exec(commands, (err, stdout, stderr) => {
      if (stdout) showMessage(stdout);
      if (stderr) showMessage(stderr);
      if (err) return reject(err);
      return resolve();
    });
  });
};

const pubDeps = async () => {
  showMessage("初始化一个通用模块插件");
  const questions = [
    ["输入项目路径", "dir"],
    ["输入通用模块名称", "name"],
  ];
  const data = await getAnswers(questions);
  const ok = await confirm(`确定创建在 ${data.dir || "当前"} 目录吗?`);
  if (!ok) return init();
  if (data.dir.slice(-1) === "/") data.dir = data.dir.slice(0, -1);

  const commands = [
    `git clone 'https://github.com/domain-js/pub-deps-boilerplate.git' ${data.dir}`,
    `cd ${data.dir}`,
    "rm -rf .git",
    `sed -i.bak "s/DEPS_NAME/${data.name}/g" *`,
    "rm *.bak",
  ].join(" && ");

  showMessage("------ The following command will be executed ------");
  showMessage(commands);

  return new Promise((resolve, reject) => {
    exec(commands, (err, stdout, stderr) => {
      if (stdout) showMessage(stdout);
      if (stderr) showMessage(stderr);
      if (err) return reject(err);
      return resolve();
    });
  });
};

const deps = async () => {
  showMessage("初始化一个项目私有模块");
  const questions = [
    ["输入项目 domain 模块根路径", "dir", ""],
    ["输入模块名称", "name"],
  ];
  const data = await getAnswers(questions);
  const ok = await confirm(`确定创建在 ${data.dir || "./"}src/deps/${data.name} 目录吗?`);
  if (!ok) return init();
  if (data.dir.slice(-1) === "/") data.dir = data.dir.slice(0, -1);

  const target = `${data.dir || "."}/src/deps/${data.name}`;
  if (fs.existsSync(target))
    return showMessage(`目录(${target})已经被占用，为避免冲突，只能创建在不存在的目录中`);

  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  fs.mkdirSync(target);

  const commands = [
    `git clone 'https://github.com/domain-js/deps-boilerplate.git' ${target}`,
    `cd ${target}`,
    "rm -rf .git",
    `sed -i.bak "s/DEPS_NAME/${data.name}/g" *`,
    "rm *.bak",
  ].join(" && ");

  showMessage("------ The following command will be executed ------");
  showMessage(commands);

  return new Promise((resolve, reject) => {
    exec(commands, (err, stdout, stderr) => {
      if (stdout) showMessage(stdout);
      if (stderr) showMessage(stderr);
      if (err) return reject(err);
      return resolve();
    });
  });
};

const file2Module = (file) => file.replace(/(-\w)/g, (m) => m[1].toUpperCase());
const filePath2Var = (_path) => file2Module(_path.replace(/[/.]+/g, "-"));
const codeStyleFormat = (targetFile) =>
  new Promise((resolve, reject) => {
    exec(`prettier -w ${targetFile} && eslint --fix ${targetFile}`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

const makeDefineFile = async (modules, targetFile, isTS) => {
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

const checkHookExport = (_dir) => {
  for (const hook of ["Before", "After"]) {
    const TSFile = path.resolve(_dir, `${hook}.ts`);
    const JSFile = path.resolve(_dir, `${hook}.js`);

    if (fs.existsSync(TSFile) && !fs.existsSync(JSFile)) {
      throw Error(`请先编译ts文件: ${_dir}`);
    }
    const Main = _require(_dir);
    if (fs.existsSync(JSFile)) {
      const Hook = _require(JSFile);
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
    checkHookExport(_dir, isTS);

    modules.push(x);
  }

  // 按字典排序，后续有变动的时候不容易冲突
  const targetFile = path.resolve(rootDir, `src/deps/defines.${ext}`);
  await makeDefineFile(modules.sort(), targetFile, isTS);
};

const checkService = (_dir) => {
  const TSFile = path.resolve(_dir, "index.ts");
  const JSFile = path.resolve(_dir, "index.js");

  if (fs.existsSync(TSFile) && !fs.existsSync(JSFile)) {
    throw Error(`请先编译ts文件: ${_dir}`);
  }
  if (!fs.existsSync(JSFile)) {
    throw Error(`创建的目录没有 index.js 文件${_dir}`);
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
    checkService(_dir, isTS);

    modules.push(x);
  }

  // 按字典排序，后续有变动的时候不容易冲突
  const targetFile = path.resolve(rootDir, `src/services/defines.${ext}`);
  await makeDefineFile(modules.sort(), targetFile, isTS);
};

const deepLoadDir = (root, parent, files = []) => {
  const paths = {};
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

const deepLoadModule = async (rootDir, targetFile) => {
  const files = [];
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

const actions = { init, pubDeps, deps, loadDeps, loadServices, deepLoadModule };

const main = async (command = "init") => {
  const action = actions[command];
  if (!action) {
    const msg = `${action} 不存在该指令，只支持 ${Object.keys(actions)}`;
    return showMessage(msg, 0);
  }
  try {
    await action(...process.argv.slice(3));
  } catch (e) {
    showMessage(e.message, 1);
  }
  return process.exit(0);
};

main(process.argv[2]);

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
