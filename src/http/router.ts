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

    server[verb](route, async (req: restify.Request, res: restify.Response, next: restify.Next) => {
      const profile = makeProfile(req, methodPath, makeProfileHook);
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
          res.send(code, code !== 204 && results);
        }
      } catch (e) {
        res.header("X-ConsumedTime", Date.now() - profile.startedAt.valueOf());
        next(error2httpError(e as Err));
        return;
      }
      next();
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
    ) => {
      register(verb, routePath, ctlAct, code, isList, handler, resHandler);
      if (verb === "put") {
        register("patch", routePath, ctlAct, code, isList, handler, resHandler);
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
   * controller 为可选参数，如果不填写则控制器名称直接就是 res ，方法为 list,add
   * 如果设置了controller 则控制器为 controller，方法为 #{res}s, add{Res}
   */
  const collection = (res: string, _routePath?: string, controller?: string) => {
    let routePath: string;
    if (typeof _routePath !== "string") {
      if (controller) {
        routePath = `/${controller}s/:${controller}Id/${res}s`;
      } else {
        routePath = `/${res}s`;
      }
    } else {
      routePath = _routePath;
    }
    if (controller) {
      register("get", routePath, `${controller}.${res}s`, 200, true);
      register("post", routePath, `${controller}.add${ucwords(res)}`, 201);
    } else {
      register("get", routePath, `${res}.list`, 200, true);
      register("post", routePath, `${res}.add`, 201);
    }
  };

  const model = (res: string, routePath = `/${res}s/:id`) => {
    register("get", routePath, `${res}.detail`);
    register("put", routePath, `${res}.modify`);
    register("patch", routePath, `${res}.modify`);
    register("del", routePath, `${res}.remove`, 204);
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
    ? [Lowercase<Collects>, Keys]
    : never
  : never;

export type PickCollections<
  paths extends string,
  Keys extends string = PickFirst<paths>,
> = Keys extends any ? PickCollection<Keys, paths> : never;

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
  collection: PickCollections<Paths> extends [infer R, infer C]
    ? (res: R, _routePath?: string, controller?: C) => ReturnType<TRouter["collection"]>
    : never;
  resource: (res: PickResources<Paths>, routePath?: string) => ReturnType<TRouter["resource"]>;
};
