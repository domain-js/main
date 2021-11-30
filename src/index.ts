import * as _ from "lodash";
import * as uuid from "uuid";
import * as ajv from "ajv";
import * as ajvFormats from "ajv-formats";
import * as async from "async";
import * as axios from "axios";
import * as cronParser from "cron-parser";
import humanInterval = require("human-interval");
import * as IORedis from "ioredis";
import * as LRU from "lru-cache";
import * as moment from "moment";
import * as mysql from "mysql2";
import * as Sequelize from "sequelize";
import * as DM from "./dm";
import Deps = require("./deps/defines");

export { Main as Http } from "./http";
export * as DM from "./dm";
export * as utils from "./utils";

type TDeps = typeof Deps;
type Merge<T> = {
  [k in keyof T]: T[k];
};

/**
 * Include from T those types that are assignable to U
 */
type Include<T, U> = T extends U ? T : never;
type RemoveReadonlyArray<T> = T extends ReadonlyArray<infer T1> ? T1 : false;

interface MDeps {
  _: typeof _;
  uuid: typeof uuid;
  ajv: typeof ajv;
  ajvFormats: typeof ajvFormats;
  async: typeof async;
  axios: typeof axios;
  cronParser: typeof cronParser;
  humanInterval: typeof humanInterval;
  IORedis: typeof IORedis;
  LRU: typeof LRU;
  moment: typeof moment;
  mysql: typeof mysql;
  Sequelize: typeof Sequelize;
}

export function Main<T extends Readonly<Array<keyof TDeps>>>(features: T) {
  /** 模块名称联合类型 */
  type MS = RemoveReadonlyArray<T>;
  type Cnf = Merge<
    TDeps[Include<keyof TDeps, MS>]["Main"] extends (arg: infer R, ...args: any[]) => any ? R : {}
  >;

  return (cnf: Cnf) => {
    const deps: MDeps = {
      _,
      uuid,
      ajv,
      ajvFormats,
      async,
      axios,
      cronParser,
      humanInterval,
      IORedis,
      LRU,
      moment,
      mysql,
      Sequelize,
    };

    const modules = DM.auto(_.pick(Deps, features) as Pick<TDeps, MS>, deps, [cnf, deps]);
    return modules;
  };
}
