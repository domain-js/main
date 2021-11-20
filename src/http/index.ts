import * as restify from "restify";
import { Router } from "./router";
import { Utils } from "./utils";
import { Cnf, Domain, Profile, HttpCodes } from "./defines";

interface Deps {
  routers(r: ReturnType<typeof Router>): void;
  domain: Domain;
  httpCodes: HttpCodes;
  swaggerDocJson?: any;
  makeProfileHook?: (obj: Profile, req: restify.Request) => any;
}

export function Main(cnf: Cnf, deps: Deps) {
  const utils = Utils(cnf);

  const { routers, domain, httpCodes, swaggerDocJson, makeProfileHook } = deps;

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
    domain,
    apisRoute: cnf.apisRoute,
    swagger: [cnf.swaggerApiPath, swaggerDocJson],
  });
  routers(router);

  // Http server start
  return () => {
    server.listen(cnf.port || 8088, cnf.host || "127.0.0.1", () => {
      console.log("%s listening at %s", server.name, server.url);
    });

    return server;
  };
}
