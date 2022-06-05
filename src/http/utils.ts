import * as crypto from "crypto";
import { PlainObject, stringify } from "csv-stringify";
import * as fs from "fs";
import _ from "lodash";
import * as os from "os";
import * as restify from "restify";
import * as xlsx from "xlsx";

import { Cnf, Profile } from "./defines";

const str2arr = ["_includes", "dimensions", "metrics", "_attrs"];
const enc = encodeURI;
const TMPDIR = os.tmpdir();

export function Utils(cnf: Cnf) {
  const proxyIps = new Set((cnf.proxyIps || "127.0.0.1").split(","));

  const utils = {
    ucwords(value: string) {
      return `${value[0].toUpperCase()}${value.substring(1)}`;
    },
    /** 真实的连接请求端ip */
    remoteIp(req: restify.Request) {
      const { socket } = req;
      return socket.remoteAddress || "";
    },

    /**
     * 获取客户端真实ip地址
     */
    clientIp(req: restify.Request) {
      return (req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || utils.remoteIp(req))
        .toString()
        .split(",")[0];
    },

    /**
     * 获取可信任的真实ip
     */
    realIp(req: restify.Request) {
      const remoteIp = utils.remoteIp(req);
      if (!proxyIps.has(remoteIp)) return remoteIp;
      return (req.headers["x-real-ip"] || remoteIp).toString();
    },

    /**
     * 构造profile参数
     */
    makeProfile<T extends {} = {}>(
      req: restify.Request,
      method: string,
      customFn?: (obj: Profile, req: restify.Request) => T,
    ): Profile & T {
      const obj: Profile = {
        clientIp: utils.clientIp(req),
        remoteIp: utils.remoteIp(req),
        realIp: utils.realIp(req),
        userAgent: req.userAgent(),
        startedAt: new Date(),
        requestId: req.id(),
        method,
        type: "user",
        extra: {},
      };
      if (req.headers["x-auth-user-type"]) {
        obj.type = req.headers["x-auth-user-type"].toString();
      }
      const token = req.headers["x-auth-token"] || req.query.access_token || req.query.accessToken;

      // token 和签名认证只能二选一
      if (token) {
        obj.token = token;
      } else {
        // 处理签名认证的方式
        const signature = req.headers["x-auth-signature"] as string;
        if (signature) {
          obj.sign = {
            signature,
            uri: req.url || "/",
            key: req.headers["x-auth-key"] as string,
            timestamp: Number(req.headers["x-auth-timestamp"] as string) | 0,
            signMethod: req.headers["x-auth-sign-method"] as "HmacSHA256",
            signVersion: req.headers["x-auth-sign-version"] as "1",
            method,
          };
        }
      }

      // 客户端发布号
      obj.revision = req.headers["x-auth-revision"] as string;
      // 用户uuid 可以长期跨app
      obj.uuid = req.headers["x-auth-uuid"] as string;

      if (customFn) Object.assign(obj, customFn(obj, req));

      return obj as Profile & T;
    },

    /**
     * 构造领域方法所需的 params 参数
     */
    makeParams(req: restify.Request) {
      let params = { ...req.params, ...req.query };
      if (_.isObject(req.body) && !Array.isArray(req.body)) {
        params = { ...req.body, ...params };
      } else if (req.body) {
        params.__raw = req.body;
      }

      // 逗号分隔的属性，自动转换为 array
      for (const k of str2arr) {
        if (params[k] && _.isString(params[k])) params[k] = params[k].split(",");
      }

      if (_.size(req.files)) params.__files = req.files;
      return params;
    },

    /**
     *
     * 输出csv相关
     */
    async outputCSV(rows: any[], params: any, res: restify.Response, isXLSX = false) {
      const { _names, _cols, _filename } = params;
      if (!_.isString(_cols)) return false;
      if (_names && !_.isString(_names)) return false;
      const keys = _cols.split(",");
      const titles = (_names || _cols).split(",");
      const filename = _filename || `data.${isXLSX ? "xlsx" : "csv"}`;
      res.header("Content-disposition", `attachment; filename*=UTF-8''${enc(filename)}`);
      const mimeType = isXLSX ? "application/xlsx" : "text/csv";
      res.header("Content-type", mimeType);

      if (isXLSX) {
        const file = `${TMPDIR}/${crypto.randomBytes(16).toString("hex")}.xlsx`;
        const workBook = xlsx.utils.book_new();
        const workSheet = xlsx.utils.aoa_to_sheet([
          titles,
          ...rows.map((x) => keys.map((k) => x[k])),
        ]);
        xlsx.utils.book_append_sheet(workBook, workSheet);
        xlsx.writeFile(workBook, file, { bookType: "xlsx", type: "binary" });
        await new Promise((resolve: Function) => {
          const stream = fs.createReadStream(file);
          stream.pipe(res);
          stream.on("end", () => {
            resolve();
            fs.unlinkSync(file);
          });
        });
      } else {
        await new Promise((resolve) => {
          const stream = stringify(rows, {
            header: true,
            columns: _.zipObject(keys, titles) as PlainObject<string>,
          });
          stream.pipe(res);
          stream.on("end", resolve);
        });
      }

      return true;
    },
  };

  return utils;
}
