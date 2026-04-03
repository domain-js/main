import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import { randomUUID } from "crypto";
import Fastify, { FastifyRequest } from "fastify";
import socketio from "fastify-socket.io";
import { Server } from "socket.io";

import { Cnf, Domain, HttpCodes, Profile } from "./defines";
import { Router } from "./router";
import { BridgeSocket } from "./socket";
import { Utils } from "./utils";

export function Main(
  cnf: Cnf,
  deps: {
    routers: (r: any) => void;
    domain: Domain;
    httpCodes: HttpCodes;
    makeProfileHook?: (obj: Profile, req: FastifyRequest) => any;
    socketLogger?: (...args: any[]) => void;
  },
) {
  const utils = Utils(cnf);

  const { routers, domain, httpCodes, makeProfileHook, socketLogger } = deps;

  const server = Fastify({
    genReqId: () => randomUUID(),
  });
  server.setErrorHandler((error, request, reply) => {
    const { code, message, data } = error as unknown as {
      code: string;
      message: string;
      data: any;
    };
    const statusCode = httpCodes[code] || 500;
    // Send error response
    reply.code(statusCode).send({ code, message, data });
  });

  const bodyLimit = cnf.bodyMaxBytes || 10 * 1024 * 1024;
  // 仅注册 MIME，使 Fastify 接受 XML 类 Content-Type（否则会 FST_ERR_CTP_INVALID_MEDIA_TYPE）。
  // parseAs: "string" 只是把请求体读成原始字符串，不做 XML 结构化解析；解析由业务层按需进行。
  server.addContentTypeParser(
    ["application/xml", "text/xml", "application/rss+xml", "application/atom+xml"],
    { parseAs: "string", bodyLimit },
    (_req, body, done) => {
      done(null, body);
    },
  );

  server.register(multipart, {
    limits: {
      fileSize: bodyLimit, // 参数最大容量 10MB
    },
  });
  server.register(formbody);
  server.register(socketio, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const router = Router({
    utils,
    server,
    httpCodes,
    makeProfileHook,
    domain,
    apisRoute: cnf.apisRoute,
  });
  routers(router);

  // 根据需求起送socket服务
  if (cnf.socket) {
    server.ready((_err) => {
      const io = server.io;
      // 处理日志
      if (socketLogger) {
        io.on("connection", (socket) => {
          const { emit } = socket;
          socket.emit = (...args) => {
            socketLogger("emit", socket.id, args);
            return emit.apply(socket, args);
          };
          socketLogger("connection", socket.id, socket.handshake);
          socket.use((args, next) => {
            next();
            socketLogger("use", socket.id, args);
          });
          socket.on("disconnect", (reason) => {
            socketLogger("disconnect", socket.id, reason);
          });
        });
      }
      BridgeSocket(io, domain);
    });
  }

  // Http server start
  return () => {
    const port = cnf.port || 8088;
    const host = cnf.host || "127.0.0.1";
    server.listen({ port, host }, (err, address) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log("[%s] listening at %s", new Date().toISOString(), address);
    });

    return server;
  };
}

declare module "fastify" {
  interface FastifyInstance {
    io: Server<any>;
  }
}
