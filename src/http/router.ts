import _ from "lodash";
import * as restify from "restify";
import * as errors from "restify-errors";

import { Domain, Err, HttpCodes, Profile } from "./defines";
import { Utils } from "./utils";

type Verb = "get" | "post" | "put" | "patch" | "del";
interface Deps {
  domain: Domain;
  utils: ReturnType<typeof Utils>;
  server: restify.Server;
  httpCodes: HttpCodes;
  makeProfileHook?: (obj: Profile, req: restify.Request) => any;
  apisRoute?: string;
  swagger?: [any, any];
}

/** 对 params 的处理函数 */
type Handler = (params: any) => void;

/** 对执行结构的处理 */
type ResHandler = (results: any, res: restify.Response, params?: any) => void;

export function Router(deps: Deps) {
  const { domain, apisRoute, utils, server, httpCodes = {}, makeProfileHook } = deps;
  const { ucwords, makeParams, makeProfile, outputCSV } = utils;

  // 改写 HttpErrorToJSON 处理 data
  const HttpErrorToJSON = errors.HttpError.prototype.toJSON;
  errors.HttpError.prototype.toJSON = function toJSON() {
    const json = HttpErrorToJSON.call(this);
    if (this.body.data) json.data = this.body.data;

    return json;
  };

  const error2httpError = (error: Err) => {
    const { code, message, data } = error;
    const e = errors.makeErrFromCode((code && httpCodes[code]) || 500, message);

    if (code) e.body.code = code;
    if (data) e.body.data = data;

    return e;
  };

  const apis: string[] = [];
  let apisHTML = "<h3>API 目录，点击可以查看参数格式定义</h3>";

  /** 判断是否需要提供apis的查询接口 */
  if (apisRoute) {
    server.get(`/${apisRoute}`, (req, res, next) => {
      if (req.query._format === "html") {
        res.sendRaw(200, apisHTML, {
          "Content-Type": "text/html; charset=utf-8",
        });
      } else {
        res.send(apis);
      }
      next();
    });

    server.get(`/${apisRoute}/_schema`, (req, res, next) => {
      const { path } = req.query;

      try {
        const { all } = req.query;
        const profile = domain[path]["profile"];
        const params = domain[path]["params"];
        res.send(all === undefined ? params : [profile, params]);
      } catch (e) {
        next(error2httpError(e as Err));
        return;
      }
      next();
    });
  }

  // eslint-disable-next-line max-params
  function register(
    verb: Verb,
    route: string,
    methodPath: string,
    code = 200,
    isList = false,
    handler?: Handler,
    resHandler?: ResHandler,
    resource?: string,
  ) {
    /**
     * 暂存起来，提供给apis接口来
     *  apis接口用来返回当前 services 提供的可用的 api
     */
    apis.push(`[${verb.toUpperCase()}] ${route} Domain: ${methodPath}`);
    apisHTML += `\n<li><a href="./${apisRoute}/_schema?path=${methodPath}">[${verb.toUpperCase()}] ${route} Domain: ${methodPath}</a></li>`;

    if (!domain[methodPath]) throw Error(`Missing domain method: ${methodPath}`);
    const { method } = domain[methodPath];
    /** 如果都没有则抛出异常 */
    if (!method || !_.isFunction(method)) {
      throw Error(`Missing domain method: ${methodPath}`);
    }

    const send = async (res: restify.Response, results: any, isEventStream = false) => {
      if (typeof results === "object" && "pipe" in results) {
        if (isEventStream) {
          res.setHeader("Content-Type", "text/event-stream");
          await new Promise((resolve) => {
            results.on("data", (chunk: any) => {
              res.write(chunk);
            });
            results.on("end", resolve);
          });
          res.end();
        } else {
          results.pipe(res);
        }
      } else {
        res.send(code, results);
      }
    };

    server[verb](route, async (req: restify.Request, res: restify.Response) => {
      const profile = makeProfile(req, methodPath, makeProfileHook);
      if (resource) profile.resource = resource;
      const params = makeParams(req);

      // 额外处理 params
      if (handler) handler(params);

      res.header("X-RequestID", profile.requestId);

      try {
        let results = await method(profile, params);
        res.header("X-ConsumedTime", Date.now() - profile.startedAt.valueOf());
        if (results === null || results === undefined) results = "Ok";
        if (resHandler) {
          resHandler(results, res, params);
        } else if (isList) {
          const { _ignoreTotal, _format } = params;
          if (_ignoreTotal !== "yes") {
            res.header("X-Content-Record-Total", results.count);
          }
          let ok = false;
          if (_format === "csv" || _format === "xlsx") {
            // 导出csv
            ok = await outputCSV(results.rows, params, res, _format === "xlsx");
          }

          if (!ok) res.send(code, results.rows);
        } else if (!_.isObject(results)) {
          if (code === 204) {
            res.send(code);
          } else {
            res.sendRaw(code, String(results));
          }
        } else {
          await send(res, code !== 204 && results, req.header("response-event-stream") === "yes");
        }
      } catch (e) {
        res.header("X-ConsumedTime", Date.now() - profile.startedAt.valueOf());
        throw error2httpError(e as Err);
      }
    });
  }

  function RouterVerbFn(verb: Verb) {
    return (
      routePath: string,
      ctlAct: string,
      code = 200,
      isList = false,
      handler?: Handler,
      resHandler?: ResHandler,
      resource?: string,
      // eslint-disable-next-line max-params
    ) => {
      register(verb, routePath, ctlAct, code, isList, handler, resHandler, resource);
      if (verb === "put") {
        register("patch", routePath, ctlAct, code, isList, handler, resHandler, resource);
      }
    };
  }

  const router = {
    get: RouterVerbFn("get"),
    post: RouterVerbFn("post"),
    put: RouterVerbFn("put"),
    del: RouterVerbFn("del"),
  };

  /**
   * 集合方法，集合方法包含了向集合添加元素，以及查看集合(列表)
   * @param res 资源名称，如果有父级资源用双分号隔开 eg user, user::file
   * @param _routePath 路径地址，可选，默认按照既定规则拼接
   */
  const collection = (res: string, _routePath?: string) => {
    const arr = res.split("::");
    const name = arr[1] ? arr[1] : arr[0];
    const controller = arr[1] ? arr[0] : null;
    let routePath: string;
    if (typeof _routePath !== "string") {
      if (controller) {
        routePath = `/${controller}s/:${controller}Id/${name}s`;
      } else {
        routePath = `/${name}s`;
      }
    } else {
      routePath = _routePath;
    }

    if (controller) {
      register("get", routePath, `${controller}.${name}s`, 200, true, undefined, undefined, name);
      register(
        "post",
        routePath,
        `${controller}.add${ucwords(name)}`,
        201,
        false,
        undefined,
        undefined,
        name,
      );
    } else {
      register("get", routePath, `${name}.list`, 200, true, undefined, undefined, name);
      register("post", routePath, `${name}.add`, 201, false, undefined, undefined, name);
    }
  };

  const model = (res: string, routePath = `/${res}s/:id`) => {
    register("get", routePath, `${res}.detail`, 200, false, undefined, undefined, res);
    register("put", routePath, `${res}.modify`, 200, false, undefined, undefined, res);
    register("patch", routePath, `${res}.modify`, 200, false, undefined, undefined, res);
    register("del", routePath, `${res}.remove`, 204, false, undefined, undefined, res);
  };

  const resource = (res: string, routePath = `/${res}s`) => {
    collection(res, routePath);
    model(res, `${routePath}/:id`);
  };

  return Object.assign(router, { collection, model, resource });
}

type TRouter = ReturnType<typeof Router>;

/** 普通路径动作类型集合 */
type normalVerb = "get" | "post" | "put" | "del";

type NoramVerbArguments = Parameters<TRouter["get"]>;

/** 从用点分隔的字符串中提取第一部分 */
type PickFirst<paths extends string> = paths extends string
  ? paths extends `${infer F}.${string}`
    ? F
    : never
  : never;

/**
 * 从 services 路径中题可能的 model 名称的联合类型
 */
type PickModels<paths extends string, Keys extends string = PickFirst<paths>> = Keys extends any
  ? `${Keys}.detail` | `${Keys}.modify` | `${Keys}.remove` extends paths
    ? Keys
    : never
  : never;

/**
 * 从 services 路径中题可能的 resource 名称的联合类型
 */
type PickResources<paths extends string, Keys extends string = PickFirst<paths>> = Keys extends any
  ?
      | `${Keys}.add`
      | `${Keys}.list`
      | `${Keys}.detail`
      | `${Keys}.modify`
      | `${Keys}.remove` extends paths
    ? Keys
    : never
  : never;

/**
 * 根据指定的 controller 尝试提取存在的 collectname
 * type t2 = PickCollection<"user", "user.addFile" | "user.Files"> // File
 */
type PickCollect<Keys extends string, paths extends string> = paths extends `${Keys}.add${infer A}`
  ? A
  : never;

type PickCollection<
  Keys extends string,
  paths extends string,
  Collects extends string = PickCollect<Keys, paths>,
> = Collects extends any
  ? `${Keys}.add${Collects}` | `${Keys}.${Lowercase<Collects>}s` extends paths
    ? `${Keys}::${Lowercase<Collects>}`
    : never
  : never;

export type PickCollections<
  paths extends string,
  Keys extends string = PickFirst<paths>,
> = Keys extends any
  ? PickCollection<Keys, paths> | (`${Keys}.add` | `${Keys}.list` extends paths ? Keys : never)
  : never;

/**
 * 利用领域方法路径类型集合，收窄 methodPath, 同时可以自动提示
 */
export type NarrowDomainPaths<Paths extends string> = {
  [k in normalVerb]: (
    routePath: NoramVerbArguments[0],
    ctlAct: Paths,
    code?: NoramVerbArguments[2],
    isList?: NoramVerbArguments[3],
    handler?: NoramVerbArguments[4],
    resHandler?: NoramVerbArguments[5],
  ) => ReturnType<TRouter["get"]>;
} & {
  model: (res: PickModels<Paths>, routePath?: string) => ReturnType<TRouter["model"]>;
  collection: (
    res: PickCollections<Paths>,
    routePath?: string,
  ) => ReturnType<TRouter["collection"]>;
  resource: (res: PickResources<Paths>, routePath?: string) => ReturnType<TRouter["resource"]>;
};
