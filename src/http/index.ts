import * as restify from "restify";
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
    makeProfileHook?: (obj: Profile, req: restify.Request) => any;
    socketLogger?: (...args: any[]) => void;
  },
) {
  const utils = Utils(cnf);

  const { routers, domain, httpCodes, makeProfileHook, socketLogger } = deps;

  const server = restify.createServer();
  server.use(restify.plugins.queryParser());
  server.use(
    restify.plugins.bodyParser({
      keepExtensions: true,
      maxFieldsSize: cnf.bodyMaxBytes || 2 * 1024 * 1024, // 参数最大容量 2MB
      multiples: cnf.fileUploadMultiple || false, // 是否支持多文件上传
    }),
  );

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
    const io = new Server(server);
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
  }

  // Http server start
  return () => {
    server.listen(cnf.port || 8088, cnf.host || "127.0.0.1", () => {
      console.log("%s listening at %s", server.name, server.url);
    });

    return server;
  };
}
