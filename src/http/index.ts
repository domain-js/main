import * as restify from "restify";
import { Server } from "socket.io";

import { Cnf, Domain, GetSchemaByPath, HttpCodes, Profile } from "./defines";
import { Router } from "./router";
import { BridgeSocket } from "./socket";
import { Utils } from "./utils";

interface Deps {
  routers: (r: ReturnType<typeof Router>) => void;
  domain: Domain;
  httpCodes: HttpCodes;
  getSchemaByPath: GetSchemaByPath;
  makeProfileHook?: (obj: Profile, req: restify.Request) => any;
}

export function Main(cnf: Cnf, deps: Deps) {
  const utils = Utils(cnf);

  const { routers, getSchemaByPath, domain, httpCodes, makeProfileHook } = deps;

  const server = restify.createServer();
  server.use(restify.plugins.queryParser());
  server.use(
    restify.plugins.bodyParser({
      keepExtensions: true,
      maxFieldsSize: cnf.bodyMaxBytes || 2 * 1024 * 1024, // 参数最大容量 2MB
    }),
  );

  const router = Router({
    utils,
    server,
    httpCodes,
    makeProfileHook,
    getSchemaByPath,
    domain,
    apisRoute: cnf.apisRoute,
  });
  routers(router);

  // 根据需求起送socket服务
  if (cnf.socket) {
    const io = new Server(server);
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
