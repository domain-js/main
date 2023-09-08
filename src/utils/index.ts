import async from "async";
import * as crypto from "crypto";
import fs from "fs";
import path from "path";

/** 随机字符串字典 */
const RAND_STR_DICT = {
  normal: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  strong:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&’()*+,-./:;<=>?@[]^_`{|}~",
};

/**
 * Calculates the MD5 value of the given string
 * @param str string or An object that contains a toString method that returns a string
 * @returns hex md5 string
 */
export const md5 = (str: { toString: () => string }) => {
  const hash = crypto.createHash("md5");
  return hash.update(str.toString()).digest().toString("hex");
};

/**
 * Return random string
 * @param len string length
 * @param type "strong" or "normal" or other string that custom character range string
 */
export function randStr(len: number, type: "strong"): string;
export function randStr(len: number, type?: "normal"): string;
// eslint-disable-next-line @typescript-eslint/unified-signatures
export function randStr(len: number, type: string): string;
export function randStr(len: number, type = "normal"): string {
  const dict = type === "strong" || type === "normal" ? RAND_STR_DICT[type] : type;
  const { length } = dict;

  /** 随机字符串的长度不能等于 0 或者负数 */
  const _len = Math.max(3, len | 0);

  return Array(_len)
    .fill("")
    .map(() => dict[Math.floor(Math.random() * length)])
    .join("");
}

/**
 * Replace line breaks and tabs in the string with ordinary spaces
 * @param value string that will be replaced
 * @returns has been replaced string
 */
export const nt2space = (value: string) => value.replace(/(\\[ntrfv]|\s)+/g, " ").trim();

/**
 * The first character of the string is capitalized
 * @param value string
 * @returns string
 * @example ufrist("hello"); // Return a string is: "Hello"
 * @see lcfirst
 */
export const ucfirst = (value: string) => value[0].toUpperCase() + value.substring(1);

/**
 * The first character of the string is lowercase
 * @param value string
 * @returns string
 * @example ufrist("Hello"); // Return a string is: "hello"
 * @see ucfirst
 */
export const lcfirst = (value: string) => value[0].toLowerCase() + value.substring(1);

/**
 * Pause, waiting
 * @param ms The time you want to wait, in milliseconds
 * @returns None
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Freeze a object and deepth
 * @param object The object that will be freezed
 * @returns freezed object
 */
export const deepFreeze = <T>(object: T) => {
  // Retrieve the property names defined on object
  const propNames = Object.getOwnPropertyNames(object);

  for (const name of propNames) {
    const value = (object as any)[name];

    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }

  return Object.freeze(object);
};

/** try catch 包裹执行, 记录错误日志 */
type TryCatchLogFn = <
  T extends (...args: any[]) => Promise<void>,
  L extends (...args: any[]) => void,
>(
  fn: T,
  errorLog: L,
) => (...args: Parameters<T>) => Promise<void>;

/**
 * Mask exceptions of functions
 * @param fn The function will be mask exceptions
 * @param errorLog Error handle function, when has happed throw exception
 * @returns Wrapped function
 */
export const tryCatchLog: TryCatchLogFn = (fn, errorLog) => {
  const wrapped = async (...args: Parameters<typeof fn>) => {
    try {
      await fn(...args);
    } catch (e) {
      errorLog(e);
    }
  };

  return wrapped;
};

/**
 * Determine whether a second timestamp has expired
 * @param time timestamp
 * @param life Effective time, seconds
 * @returns true or false
 */
export const inExpired = (time: number, life: number) => {
  const now = (Date.now() / 1000) | 0;

  return time < now - life;
};

interface Params {
  [K: string]: string;
}
/**
 * Modify a URL address, add some attributes and delete some attributes
 * @param address URL address
 * @param adds The params will be expand to address
 * @param removes The string list will be remove from address
 * @returns Modified address
 */
export const modifyURL = (address: string, adds?: Params, removes?: string[]) => {
  const obj = new URL(address);

  if (typeof adds === "object") {
    for (const key of Object.keys(adds)) {
      obj.searchParams.append(key, adds[key]);
    }
  }

  if (Array.isArray(removes)) {
    for (const key of removes) obj.searchParams.delete(key);
  }

  return obj.toString();
};

/**
 * @deprecated
 * alias modifyURL
 */
export const modifiyURL = modifyURL;

/**
 * 等待，知道 test 返回 true
 * @param test 检测函数
 * @param intervalMS 间隔多久判断一次, 单位毫秒 默认 100
 */
export const waitFor = async (test: () => boolean, intervalMS = 100) => {
  await async.doUntil(
    async () => {
      await sleep(intervalMS);
    },
    async () => test(),
  );
};

/**
 * 读取录下的所有文件，之后返回数组
 * params
 *   dir 要加载的目录
 *   exts 要加载的模块文件后缀，多个可以是数组, 默认为 coffee
 *   excludes 要排除的文件, 默认排除 index
 */
/**
 * 读取录下的所有文件，之后返回数组
 * @param dir 要读取的目录
 * @param exts 要读取的文件后缀，不包含 (.) 点，例如 jpg 而非 .jpg
 * @param excludes 要排除的文件列表
 * @param files 读取到的文件路径存放地址
 */
export const deepReaddir = (
  dir: string,
  exts: Set<string>,
  excludes: Set<string> = new Set(),
  files: string[] = [],
) => {
  for (const x of fs.readdirSync(dir)) {
    const file = path.resolve(dir, x);
    const stat = fs.lstatSync(file);
    if (stat.isFile()) {
      // 忽略隐藏文件
      if (x[0] === ".") continue;

      const arr = x.split(".");
      const ext = arr.pop();
      const name = arr.join(".");
      // 如果是不希望的后缀或者排除的名称，则直接忽略/跳过
      if ((ext && !exts.has(ext)) || excludes.has(name)) continue;
      files.push(file);
    } else if (stat.isDirectory()) {
      deepReaddir(file, exts, excludes, files);
    }
  }

  return files;
};

/**
 * 判断某个值是否为一个流
 * @param stream 要判断的对象
 */
export const isStream = (stream: any) =>
  stream && typeof stream === "object" && typeof stream.pipe === "function";
