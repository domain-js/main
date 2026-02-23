import * as ajv from "ajv";
import * as ajvFormats from "ajv-formats";
import ajvKeywords from "ajv-keywords";
import { CronExpressionParser } from "cron-parser";
import humanInterval from "human-interval";
import IORedis from "ioredis";
import LRU from "lru-cache";
import * as mysql from "mysql2";
import * as Sequelize from "sequelize";

import { errors } from "./basic-errors";
import * as utils from "./utils";

/** npm packages injection */
export interface Defaults {
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
  ajvKeywords: typeof ajvKeywords;
  /**
   * Node.js library for parsing and manipulating crontab instructions.
   * It includes support for timezones and DST transitions.
   * @link https://www.npmjs.com/package/cron-parser
   */
  cronParser: typeof CronExpressionParser;
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
  ajv,
  ajvFormats,
  ajvKeywords,
  cronParser: CronExpressionParser,
  humanInterval,
  IORedis,
  LRU,
  mysql,
  Sequelize,
  utils,
  U: utils,
  errors,
};
