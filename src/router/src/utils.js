const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const _ = require("lodash");
const xlsx = require("xlsx");
const csvstringify = require("csv-stringify");

const str2arr = ["_includes", "dimensions", "metrics", "_attrs"];
const enc = encodeURI;
const TMPDIR = os.tmpdir();
const proxyIps = new Set((process.env.PROXY_IPS || "127.0.0.1").split(","));

const utils = {
  ucwords(value) {
    return `${value[0].toUpperCase()}${value.substring(1)}`;
  },
  /** 真实的连接请求端ip */
  remoteIp(req) {
    const { connection, socket } = req;
    return (
      (connection && connection.remoteAddress) ||
      (socket && socket.remoteAddress) ||
      (connection && connection.socket && connection.socket.remoteAddress)
    );
  },

  /**
   * 获取客户端真实ip地址
   */
  clientIp(req) {
    return (
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      utils.remoteIp(req)
    ).split(",")[0];
  },

  /**
   * 获取可信任的真实ip
   */
  realIp(req) {
    const remoteIp = utils.remoteIp(req);
    if (!proxyIps.has(remoteIp)) return remoteIp;
    return req.headers["x-real-ip"] || remoteIp;
  },

  /**
   * 构造profile参数
   */
  makeProfile(req, method, customFn) {
    const obj = {
      clientIp: utils.clientIp(req),
      remoteIp: utils.remoteIp(req),
      realIp: utils.realIp(req),
      userAgent: req.userAgent(),
      startedAt: new Date(),
      requestId: req.id(),
    };

    const token = req.headers["x-auth-token"] || req.query.access_token || req.query.accessToken;

    // token 和签名认证只能二选一
    if (token) {
      obj.token = token;
    } else {
      // 处理签名认证的方式
      const signature = req.headers["x-auth-signature"];
      if (signature) {
        obj.sign = {
          signature,
          uri: req.url,
          key: req.headers["x-auth-key"],
          timestamp: req.headers["x-auth-timestamp"] | 0,
          signMethod: req.headers["x-auth-sign-method"],
          signVersion: req.headers["x-auth-sign-version"],
          method,
        };
      }
    }

    if (customFn) customFn(obj, req);

    // 客户端发布号
    obj.revision = req.headers["x-auth-revision"];
    // 用户uuid 可以长期跨app
    obj.uuid = req.headers["x-auth-uuid"];

    return Object.freeze(obj);
  },

  /**
   * 构造领域方法所需的 params 参数
   */
  makeParams(req) {
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
  async outputCSV(rows, params, res, isXLSX = false) {
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
      await new Promise((resolve) => {
        const stream = fs.createReadStream(file);
        stream.pipe(res);
        stream.on("end", () => {
          resolve();
          fs.unlinkSync(file);
        });
      });
    } else {
      await new Promise((resolve) => {
        const stream = csvstringify(rows, {
          header: true,
          columns: _.zipObject(keys, titles),
        });
        stream.pipe(res);
        stream.on("end", resolve);
      });
    }

    return true;
  },

  jsonSchema2Swagger(schema, verb, methodPath, swaggerDocJson) {
    if (verb === "post" || verb === "put" || verb === "patch") {
      swaggerDocJson.definitions[methodPath] = schema;
      return [
        {
          name: "body",
          in: "body",
          require: true,
          description: schema.description,
          operationId: methodPath,
          schema: {
            $ref: `#/definitions/${methodPath}`,
          },
        },
      ];
    }
    const parameters = [];
    if (!hasOwnProperty.call(schema, "properties")) {
      return parameters;
    }

    const requireds = schema.required ? schema.required : [];
    for (const prop of Object.keys(schema.properties)) {
      const val = schema.properties[prop];
      const param = {
        name: prop,
        in: "query",
        ...val,
      };

      if (requireds.includes("prop")) {
        param.required = true;
      }
      parameters.push(param);
    }
    return parameters;
  },
};

module.exports = utils;
