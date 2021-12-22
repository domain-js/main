import * as path from "path";
import * as fs from "fs";
import { compile } from "json-schema-to-typescript";

const _require = require;

async function main(file: string, single = false, name = "Params") {
  const stats = fs.statSync(file);
  if (stats.isFile()) {
    const arr = file.split(".");
    if (arr.pop() !== "js") return;
    const obj = _require(file);
    if (!single) {
      if (!Array.isArray(obj)) return;
      if (typeof obj[1] !== "object") return;
    }
    try {
      const ts = await compile(single ? obj : obj[1], name);
      arr.push("d.ts");
      fs.writeFileSync(arr.join("."), ts);
    } catch (e) {
      console.error(file, e);
    }
    return;
  }
  const files = fs.readdirSync(file);
  for await (const x of files) {
    if (x === "." || x === "..") continue;
    await main(path.resolve(file, x), single, name);
  }
}

main(process.argv[2], process.argv[3] === "single", process.argv[4]);
