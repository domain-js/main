import * as ajv from "ajv";
import * as ajvFormats from "ajv-formats";
import * as async from "async";
import * as axios from "axios";
import * as cronParser from "cron-parser";
import humanInterval from "human-interval";
import IORedis from "ioredis";
import _ from "lodash";
import LRU from "lru-cache";
import moment from "moment";
import * as mysql from "mysql2";
import * as Sequelize from "sequelize";
import * as uuid from "uuid";

import { errors } from "./basic-errors";
import * as utils from "./utils";

/** npm packages injection */
export interface Defaults {
  /**
   * The Lodash library exported as Node.js modules.
   * @link https://www.npmjs.com/package/lodash
   */
  _: typeof _;
  /**
   * For the creation of RFC4122 UUIDs
   * @link https://www.npmjs.com/package/uuid
   */
  uuid: typeof uuid;
  /**
   * Ajv JSON schema validator
   * @link https://www.npmjs.com/package/ajv
   */
  ajv: typeof ajv;
  /**
   * JSON Schema formats for Ajv
   * @link https://www.npmjs.com/package/ajv-formats
   */
  ajvFormats: typeof ajvFormats;
  /**
   * Async is a utility module which provides straight-forward
   * powerful functions for working with asynchronous JavaScript.
   * @link https://www.npmjs.com/package/async
   */
  async: typeof async;
  /**
   * Promise based HTTP client for the browser and node.js
   * @Link https://www.npmjs.com/package/axios
   */
  axios: typeof axios;
  /**
   * Node.js library for parsing and manipulating crontab instructions.
   * It includes support for timezones and DST transitions.
   * @link https://www.npmjs.com/package/cron-parser
   */
  cronParser: typeof cronParser;
  /**
   * Human-readable interval parser for Javascript.
   * @link https://www.npmjs.com/package/human-interval
   */
  humanInterval: typeof humanInterval;
  /**
   * A robust, performance-focused and full-featured Redis client for Node.js.
   * @link https://www.npmjs.com/package/ioredis
   */
  IORedis: typeof IORedis;
  /**
   * A cache object that deletes the least-recently-used items.
   * https://www.npmjs.com/package/lru-cache
   */
  LRU: typeof LRU;
  /**
   * MySQL client for Node.js with focus on performance.
   * Supports prepared statements, non-utf8 encodings,
   * binary log protocol, compression, ssl much more
   * @link https://www.npmjs.com/package/mysql2
   */
  mysql: typeof mysql;
  /**
   * Sequelize is a promise-based Node.js ORM tool for Postgres, MySQL, MariaDB,
   *  SQLite and Microsoft SQL Server.
   * It features solid transaction support, relations,
   *  eager and lazy loading, read replication and more.
   * @link https://www.npmjs.com/package/sequelize
   */
  Sequelize: typeof Sequelize;
  /**
   * A JavaScript date library for parsing, validating, manipulating, and formatting dates.
   */
  moment: typeof moment;

  /**
   * utils tools function
   */
  utils: typeof utils;
  /**
   * alias utils tools function
   */
  U: typeof utils;
  /**
   * basic errors
   */
  errors: typeof errors;
}

export const defaults: Defaults = {
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
  mysql,
  Sequelize,
  moment,
  utils,
  U: utils,
  errors,
};
