import * as crypto from "crypto";

/** 随机字符串字典 */
const RAND_STR_DICT = {
  normal: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  strong:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&’()*+,-./:;<=>?@[]^_`{|}~",
};

/** 计算给定字符串的md5值 */
export const md5 = (str: { toString: () => string }) => {
  const hash = crypto.createHash("md5");
  return hash.update(str.toString()).digest().toString("hex");
};

/**
 生成随机字符串,
 @type: "strong" 强壮型 包括特殊字符
 @type: "normal" 普通型 不包括特殊字符
 @type: string 随机串字典手动指定
*/
export function randStr(len: number, type: "strong"): string;
export function randStr(len: number, type: "normal"): string;
export function randStr(len: number, type: string): string;
export function randStr(len: number, type: string): string {
  const dict = type === "strong" || type === "normal" ? RAND_STR_DICT[type] : type;
  const { length } = dict;

  /** 随机字符串的长度不能等于 0 或者负数 */
  len |= 0;
  len = Math.max(len, 3);

  return Array(len)
    .fill("")
    .map(() => dict[Math.floor(Math.random() * length)])
    .join("");
}

/** 将字符串里的换行，制表符替换为普通空格 */
export const nt2space = (value: string) => value.replace(/(\\[ntrfv]|\s)+/g, " ").trim();

/** 首字符大写 */
export const ucfirst = (value: string) => value[0].toUpperCase() + value.substring(1);

/** 首字符小写 */
export const lcfirst = (value: string) => value[0].toLowerCase() + value.substring(1);

/** 睡眠等待 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 深度冻结一个对象，防止被不小心篡改 */
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
export const tryCatchLog: TryCatchLogFn =
  (fn, errorLog) =>
    async (...args) => {
      try {
        await fn(...args);
      } catch (e) {
        errorLog(e);
      }
    };

/**
 判断某个秒级时间戳是否已过期，基于当前时间
 */
export const inExpired = (time: number, life: number) => {
  const now = (Date.now() / 1000) | 0;

  return time < now - life;
};

type Params = { [K: string]: string };
/** 修改指定url上添加一些参数 */
export const modifiyURL = (address: string, adds?: Params, removes?: string[]) => {
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
