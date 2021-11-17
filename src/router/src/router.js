/**
 * 对接 domain 和 restify 以http的方式对外提供服务
 */

const _ = require("lodash");
const errors = require("restify-errors");
const swaggerUi = require("swagger-ui-restify");
const utils = require("./utils");

function Main(server, httpCodes, customFn) {
  const { ucwords, makeProfile, makeParams, outputCSV, jsonSchema2Swagger } = utils;

  // 改写 HttpErrorToJSON 处理 data
  const HttpErrorToJSON = errors.HttpError.prototype.toJSON;
  errors.HttpError.prototype.toJSON = function toJSON() {
    const json = HttpErrorToJSON.call(this);
    if (this.body.data) json.data = this.body.data;

    return json;
  };

  const error2httpError = (error) => {
    const { code, message, data } = error;
    const e = errors.makeErrFromCode((code && httpCodes[code]) || 500, message);

    if (code) e.body.code = code;
    if (data) e.body.data = data;

    return e;
  };

  /**
   * 路由器初始化
   *  params
   *  server object restify.createServer()
   *  domain 领域方法
   *  apisRoute 所有api地址查看
   */
  function Router(domain, apisRoute, swagger = []) {
    const [apiSwagger, swaggerDocJson] = swagger;
    const apis = [];
    let apisHTML = "<h3>API 目录，点击可以查看参数格式定义</h3>";

    let swaggerHtml = "";
    if (apiSwagger) {
      server.get(`/${apiSwagger}/*.*`, ...swaggerUi.serve);
      server.get(`/${apiSwagger}`, (req, res) => {
        res.writeHead(200, {
          "Content-Length": Buffer.byteLength(swaggerHtml),
          "Content-Type": "text/html",
        });
        res.write(swaggerHtml);
        res.end();
      });
    }

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
          const schema = domain._getSchemaByPath(path);
          res.send(all === undefined ? schema[1] : schema);
        } catch (e) {
          next(error2httpError(e));
          return;
        }
        next();
      });
    }

    const getAPISchemaDoc = (verb, route, methodPath) => {
      if (!apiSwagger) return;
      let apiSchema = [];
      let desc = "";
      try {
        apiSchema = domain._getSchemaByPath(methodPath);
        desc = apiSchema[1] ? apiSchema[1].description : "unknow";
        apiSchema = jsonSchema2Swagger(
          apiSchema[1] ? apiSchema[1] : {},
          verb,
          methodPath,
          swaggerDocJson,
        );
      } catch (e) {
        console.log(methodPath, "schema to swagger error.");
      }

      swaggerHtml = swaggerUi.generateHTML(swaggerDocJson, {
        baseURL: `${swaggerDocJson.basePath}${apiSwagger}`,
        explorer: true,
      });

      const apiTag = methodPath.split(".")[0];

      swaggerDocJson.paths[route] = {
        [verb]: {
          "x-swagger-router-controller": methodPath,
          operationId: methodPath,
          tags: [apiTag],
          externalDocs: {
            description: "查看接口参数 json schema 定义",
            url: `./${apisRoute}/_schema?path=${methodPath}`,
          },
          description: desc,
          parameters: apiSchema || [],
          responses: {},
        },
      };
    };

    const register = (
      verb,
      route,
      methodPath,
      code = 200,
      isList = false,
      handler = false,
      resHandler = false,
    ) => {
      /**
       * 暂存起来，提供给apis接口来用
       *  apis接口用来返回当前 services 提供的可用的 api
       */
      apis.push(`[${verb.toUpperCase()}] ${route} Domain: ${methodPath}`);
      apisHTML += `\n<li><a href="./${apisRoute}/_schema?path=${methodPath}">[${verb.toUpperCase()}] ${route} Domain: ${methodPath}</a></li>`;

      const method = _.get(domain, methodPath);
      /** 如果都没有则抛出异常 */
      if (!method || !_.isFunction(method)) {
        throw Error(`Missing domain method: ${methodPath}`);
      }

      getAPISchemaDoc(verb, route, methodPath);

      server[verb](route, async (req, res, next) => {
        const profile = makeProfile(req, methodPath, customFn);
        const params = makeParams(req);

        // 额外处理 params
        if (handler) handler(params);

        res.header("X-RequestID", profile.requestId);

        try {
          let results = await method(profile, params);
          res.header("X-ConsumedTime", Date.now() - profile.startedAt);
          if (results == null) results = "Ok";
          if (resHandler) {
            resHandler(results, res);
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
          res.header("X-ConsumedTime", Date.now() - profile.startedAt);
          next(error2httpError(e));
          return;
        }
        next();
      });
    };

    const router = {};
    _.each(["get", "post", "put", "del"], (verb) => {
      router[verb] = (routePath, ctlAct, code, isList, handler, resHandler) => {
        register(verb, routePath, ctlAct, code, isList, handler, resHandler);
        if (verb === "put") {
          register("patch", routePath, ctlAct, code, isList, handler, resHandler);
        }
      };
    });

    /**
     * controller 为可选参数，如果不填写则控制器名称直接就是 res ，方法为 list,add
     * 如果设置了controller 则控制器为 controller，方法为 #{res}s, add{Res}
     */
    router.collection = (res, _routePath, controller) => {
      let routePath = _routePath;
      if (_routePath == null) {
        if (controller) {
          routePath = `/${controller}s/:${controller}Id/${res}s`;
        } else {
          routePath = `/${res}s`;
        }
      }
      if (controller) {
        register("get", routePath, `${controller}.${res}s`, 200, true);
        register("post", routePath, `${controller}.add${ucwords(res)}`, 201);
      } else {
        register("get", routePath, `${res}.list`, 200, true);
        register("post", routePath, `${res}.add`, 201);
      }
    };

    router.model = (res, routePath = `/${res}s/:id`) => {
      register("get", routePath, `${res}.detail`);
      register("put", routePath, `${res}.modify`);
      register("patch", routePath, `${res}.modify`);
      register("del", routePath, `${res}.remove`, 204);
    };

    router.resource = (res, routePath = `/${res}s`) => {
      router.collection(res, routePath);
      router.model(res, `${routePath}/:id`);
    };

    return router;
  }

  return Router;
}

module.exports = Main;
