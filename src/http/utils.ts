import { MultipartFile } from "@fastify/multipart";
import * as crypto from "crypto";
import { PlainObject, stringify } from "csv-stringify";
import { FastifyReply, FastifyRequest } from "fastify";
import * as fs from "fs";
import _ from "lodash";
import * as os from "os";
import * as xlsx from "xlsx";

import { Cnf, Profile, UploadFile } from "./defines";

const str2arr = ["_includes", "dimensions", "metrics", "_attrs"];
const enc = encodeURI;
const TMPDIR = os.tmpdir();

export function Utils(cnf: Cnf) {
  const proxyIps = new Set((cnf.proxyIps || "127.0.0.1").split(","));

  /**
   * 判断是否是内网ip
   * 10.0.0.0 - 10.255.255.255 (10/8 前缀)
   * 172.16.0.0 - 172.31.255.255 (172.16/12 到 172.31/12 前缀)
   * 192.168.0.0 - 192.168.255.255 (192.168/16 前缀)
   */
  const isInternalIp = (ip: string) => {
    const parts = ip.split(".").map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    );
  };

  const utils = {
    ucwords(value: string) {
      return `${value[0].toUpperCase()}${value.substring(1)}`;
    },

    /** 真实的连接请求端ip */
    remoteIp(req: FastifyRequest) {
      const { socket } = req;
      return socket.remoteAddress || "";
    },

    /**
     * 获取客户端真实ip地址
     */
    clientIp(req: FastifyRequest) {
      return (req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || utils.remoteIp(req))
        .toString()
        .split(",")[0];
    },

    /**
     * 获取可信任的真实ip
     */
    realIp(req: FastifyRequest) {
      const remoteIp = utils.remoteIp(req);
      if (!proxyIps.has(remoteIp) && !isInternalIp(remoteIp)) return remoteIp;
      return (req.headers["x-real-ip"] || remoteIp).toString();
    },

    /**
     * 构造profile参数
     */
    makeProfile<T extends {} = {}>(
      req: FastifyRequest,
      method: string,
      customFn?: (obj: Profile, req: FastifyRequest) => T,
    ): Profile & T {
      const obj: Profile = {
        verb: req.method,
        clientIp: utils.clientIp(req),
        remoteIp: utils.remoteIp(req),
        realIp: utils.realIp(req),
        userAgent: req.headers["user-agent"] || "",
        startedAt: new Date(),
        requestId: req.id,
        method,
        type: "user",
        needStream:
          req.headers["response-event-stream"] === "yes" ||
          req.headers["accept"]?.includes("text/event-stream"),
        extra: {},
      };
      if (req.headers["x-auth-user-type"]) {
        obj.type = req.headers["x-auth-user-type"].toString();
      }
      const token =
        req.headers["x-auth-token"] ||
        (req.query as any).access_token ||
        (req.query as any).accessToken;

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
    async makeParams(
      req: FastifyRequest<{
        Querystring: Record<string, any>;
        Params: Record<string, any>;
        Body: Record<string, any>;
      }>,
    ) {
      let params = { ...(req.query || {}), ...(req.params || {}) };
      if (_.isObject(req.body) && !Array.isArray(req.body)) {
        params = { ...(req.body || {}), ...params };
      } else if (req.body) {
        params.__raw = req.body;
      }

      // 逗号分隔的属性，自动转换为 array
      for (const k of str2arr) {
        if (params[k] && _.isString(params[k])) params[k] = params[k].split(",");
      }

      // 检查请求是否包含文件上传
      let files = {};
      try {
        // 只有在 multipart 请求时才处理文件
        if (req.headers["content-type"]?.includes("multipart/form-data")) {
          const uploadedFile = await req.file();
          if (uploadedFile) {
            files = await RestifyFileConvertUploadFiles(uploadedFile);
          }
        }
      } catch (error) {
        // 如果文件处理出错，记录错误但不中断请求处理
        console.warn("File upload processing error:", error);
      }

      // 将上传文件附加到 params 中
      return { ...params, ...files };
    },

    /**
     *
     * 输出csv相关
     */
    async outputCSV(rows: any[], params: any, res: FastifyReply, isXLSX = false) {
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
          ...rows.map((x) => keys.map((k) => _.get(x, k))),
        ]);
        xlsx.utils.book_append_sheet(workBook, workSheet);
        xlsx.writeFile(workBook, file, { bookType: "xlsx", type: "binary" });
        await new Promise((resolve: Function) => {
          const stream = fs.createReadStream(file);
          stream.pipe(res.raw);
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
          stream.pipe(res.raw);
          stream.on("end", resolve);
        });
      }

      return true;
    },
  };

  async function RestifyFileConvertUploadFiles(
    files?: MultipartFile,
  ): Promise<Record<string, UploadFile>> {
    if (!files) return {};

    const result: Record<string, UploadFile> = {};

    // 生成临时文件路径
    const tempFileName = `${crypto.randomBytes(16).toString("hex")}_${files.filename}`;
    const tempFilePath = `${TMPDIR}/${tempFileName}`;

    // 将文件流保存到临时文件
    return new Promise<Record<string, UploadFile>>((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempFilePath);
      const fileStream = files.file;

      let fileSize = 0;

      fileStream.on("data", (chunk: Buffer) => {
        fileSize += chunk.length;
      });

      fileStream.pipe(writeStream);

      writeStream.on("finish", () => {
        // 获取文件状态信息
        const stats = fs.statSync(tempFilePath);

        const uploadFile: UploadFile = {
          size: fileSize,
          path: tempFilePath,
          name: files.filename,
          type: files.mimetype,
          mtime: stats.mtime.toISOString(),
        };

        result[files.fieldname] = uploadFile;
        resolve(result);
      });

      writeStream.on("error", (error) => {
        reject(error);
      });

      fileStream.on("error", (error) => {
        reject(error);
      });
    });
  }

  return utils;
}
