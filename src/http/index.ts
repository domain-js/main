import multipart from "@fastify/multipart";
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

  const server = Fastify();
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

  server.register(multipart, {
    limits: {
      fileSize: cnf.bodyMaxBytes || 10 * 1024 * 1024, // 参数最大容量 10MB
    },
  });
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
    server.ready((err) => {
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
