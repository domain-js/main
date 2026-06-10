import { EventEmitter } from "events";
import { Readable } from "stream";

import { Router } from "../router";
import { Utils } from "../utils";

const server = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

type Verb = "get" | "post" | "put" | "delete";

const domain = {
  "home.index": { method: jest.fn() },
  "home.add": { method: jest.fn() },
  "home.list": { method: jest.fn() },
  "user.detail": { method: jest.fn() },
  "user.modify": { method: jest.fn() },
  "user.remove": { method: jest.fn() },
  "user.list": { method: jest.fn() },
  "user.add": { method: jest.fn() },
  "user.files": { method: jest.fn() },
  "user.addFile": { method: jest.fn() },
};

const req = {
  headers: {
    "x-forwarded-for": "x-forwarded-for-ip",
    "x-real-ip": "x-real-ip",
    "x-auth-token": "this-is-a-token-by-headers",
    "user-agent": "UserAgentString",
  },
  header(key: string) {
    return req.headers[key as keyof typeof req.headers];
  },
  file() {
    return;
  },
  query: {
    access_token: "this-is-a-token-by-query",
  },
  userAgent() {
    return "UserAgentString";
  },
  socket: {
    remoteAddress: "127.0.0.1",
  },
  id: "this-is-request-id",
};

const res = {
  header: jest.fn(),
  code: jest.fn().mockImplementation(() => res),
  type: jest.fn().mockImplementation(() => res),
  send: jest.fn().mockImplementation(() => res),
};

const utils = Utils({});

describe("router", () => {
  const router = Router({
    utils,
    server: server as any,
    httpCodes: {},
    domain: domain as any,
  });
  server.get.mock.calls.length = 0;

  for (const verb of ["get", "post", "put", "del"] as const) {
    it(verb, async () => {
      router[verb]("/home", "home.index");

      domain["home.index"].method.mockResolvedValueOnce({ name: "redstone" });

      expect(server[(verb === "del" ? "delete" : verb) as Verb].mock.calls.length).toBe(1);
      const [apiPath, handler] =
        server[(verb === "del" ? "delete" : verb) as Verb].mock.calls.pop();
      if (verb === "put") {
        expect(server.patch.mock.calls.length).toBe(1);
        const [apiPath2, handler2] = server.patch.mock.calls.pop();
        expect(apiPath).toBe(apiPath2);
        expect(handler2).toBeInstanceOf(Function);
      }

      expect(apiPath).toEqual("/home");
      await handler(req, res);
      expect(domain["home.index"].method.mock.calls.length).toBe(1);
      expect(domain["home.index"].method.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: "x-real-ip",
          remoteIp: "127.0.0.1",
          requestId: "this-is-request-id",
          revision: undefined,
          token: "this-is-a-token-by-headers",
          userAgent: "UserAgentString",
          uuid: undefined,
        },
        { access_token: "this-is-a-token-by-query" },
      ]);

      expect(res.code.mock.calls.length).toBe(1);
      expect(res.code.mock.calls.pop()).toEqual([200]);
      expect(res.send.mock.calls.length).toBe(1);
      expect(res.send.mock.calls.pop()).toEqual([{ name: "redstone" }]);
    });
  }

  describe("event-stream", () => {
    const makeRawRes = () => {
      const raw = Object.assign(new EventEmitter(), {
        writable: true,
        writableEnded: false,
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      });
      raw.end.mockImplementation(() => {
        raw.writable = false;
        raw.writableEnded = true;
      });
      return raw;
    };

    const makeSSEReqRes = () => {
      const raw = makeRawRes();
      const sseRes = {
        header: jest.fn(),
        code: jest.fn(),
        send: jest.fn(),
        hijack: jest.fn(),
        raw,
      };
      const sseReq = { ...req, headers: { ...req.headers, "response-event-stream": "yes" } };
      return { raw, sseRes, sseReq };
    };

    it("正常结束：转发 chunk 并由服务端 end 响应", async () => {
      router.get("/sse-normal", "home.index");
      const [, handler] = server.get.mock.calls.pop();

      const stream = new Readable({ read() {} });
      domain["home.index"].method.mockResolvedValueOnce(stream);
      const { raw, sseRes, sseReq } = makeSSEReqRes();

      stream.push("data: 1\n\n");
      stream.push("data: 2\n\n");
      stream.push(null);

      await handler(sseReq, sseRes);

      expect(sseRes.hijack.mock.calls.length).toBe(1);
      expect(raw.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(raw.write.mock.calls.map((c) => String(c[0]))).toEqual(["data: 1\n\n", "data: 2\n\n"]);
      expect(raw.end.mock.calls.length).toBe(1);
    });

    it("客户端断开：销毁源流、停止写入且 Promise 正常 resolve", async () => {
      router.get("/sse-disconnect", "home.index");
      const [, handler] = server.get.mock.calls.pop();

      const stream = new Readable({ read() {} });
      domain["home.index"].method.mockResolvedValueOnce(stream);
      const { raw, sseRes, sseReq } = makeSSEReqRes();

      stream.push("data: 1\n\n");
      const pending = handler(sseReq, sseRes);
      // 等首个 chunk 经 data 事件写出
      await new Promise((r) => setImmediate(r));
      expect(raw.write.mock.calls.length).toBe(1);

      // 模拟客户端断开
      raw.writable = false;
      raw.writableEnded = true;
      raw.emit("close");

      // 断开后 handler 不应挂死
      await pending;

      expect(stream.destroyed).toBe(true);
      // 断开后即使源流仍有数据，也不再写入
      stream.push("data: 2\n\n");
      await new Promise((r) => setImmediate(r));
      expect(raw.write.mock.calls.length).toBe(1);
      expect(raw.end.mock.calls.length).toBe(0);
    });
  });

  /*
  it("collection", async () => {
    router.collection("home");

    domain["home.list"].method.mockResolvedValueOnce({ count: 1000, rows: [1, 2, 3] });
    domain["home.add"].method.mockResolvedValueOnce({ name: "redstone-list" });

    for await (const verb of ["get", "post"]) {
      expect(server[verb as Verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb as Verb].mock.calls.pop();

      const methodPath = verb === "get" ? "list" : "add";
      expect(apiPath).toEqual("/homes");
      await handler(req, res);
      expect(domain[`home.${methodPath}`].method.mock.calls.length).toBe(1);
      expect(domain[`home.${methodPath}`].method.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: "x-real-ip",
          remoteIp: "127.0.0.1",
          requestId: "this-is-request-id",
          revision: undefined,
          token: "this-is-a-token-by-headers",
          userAgent: "UserAgentString",
          uuid: undefined,
        },
        { access_token: "this-is-a-token-by-query" },
      ]);

      expect(res.send.mock.calls.length).toBe(1);
      if (verb === "get") {
        expect(res.send.mock.calls.pop()).toEqual([200, [1, 2, 3]]);
      } else {
        expect(res.send.mock.calls.pop()).toEqual([201, { name: "redstone-list" }]);
      }
    }
  });

  it("collection, parent be defined", async () => {
    router.collection("user::file");

    domain["user.files"].method.mockResolvedValueOnce({ count: 1000, rows: [1, 2, 3] });
    domain["user.addFile"].method.mockResolvedValueOnce({ name: "redstone-list" });

    for await (const verb of ["get", "post"]) {
      expect(server[verb as Verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb as Verb].mock.calls.pop();

      const methodPath = verb === "get" ? "files" : "addFile";
      expect(apiPath).toEqual("/users/:userId/files");
      await handler(req, res);
      expect(domain[`user.${methodPath}`].method.mock.calls.length).toBe(1);
      expect(domain[`user.${methodPath}`].method.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: "x-real-ip",
          remoteIp: "127.0.0.1",
          requestId: "this-is-request-id",
          revision: undefined,
          token: "this-is-a-token-by-headers",
          userAgent: "UserAgentString",
          uuid: undefined,
        },
        { access_token: "this-is-a-token-by-query" },
      ]);

      expect(res.send.mock.calls.length).toBe(1);
      if (verb === "get") {
        expect(res.send.mock.calls.pop()).toEqual([200, [1, 2, 3]]);
      } else {
        expect(res.send.mock.calls.pop()).toEqual([201, { name: "redstone-list" }]);
      }
    }
  });

  it("collection, parent be defined, and routePath be defined", async () => {
    router.collection("user::file", "/users/files");

    domain["user.files"].method.mockResolvedValueOnce({ count: 1000, rows: [1, 2, 3] });
    domain["user.addFile"].method.mockResolvedValueOnce({ name: "redstone-list" });

    for await (const verb of ["get", "post"]) {
      expect(server[verb as Verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb as Verb].mock.calls.pop();

      const methodPath = verb === "get" ? "files" : "addFile";
      expect(apiPath).toEqual("/users/files");
      await handler(req, res);
      expect(domain[`user.${methodPath}`].method.mock.calls.length).toBe(1);
      expect(domain[`user.${methodPath}`].method.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: "x-real-ip",
          remoteIp: "127.0.0.1",
          requestId: "this-is-request-id",
          revision: undefined,
          token: "this-is-a-token-by-headers",
          userAgent: "UserAgentString",
          uuid: undefined,
        },
        { access_token: "this-is-a-token-by-query" },
      ]);

      expect(res.send.mock.calls.length).toBe(1);
      if (verb === "get") {
        expect(res.send.mock.calls.pop()).toEqual([200, [1, 2, 3]]);
      } else {
        expect(res.send.mock.calls.pop()).toEqual([201, { name: "redstone-list" }]);
      }
    }
  });

  it("model", async () => {
    router.model("user");

    domain["user.detail"].method.mockResolvedValueOnce({ name: "redstone" });
    domain["user.modify"].method.mockResolvedValueOnce({ name: "redstone-modify" });
    domain["user.remove"].method.mockResolvedValueOnce(null);

    for await (const verb of ["get", "put", "del"]) {
      expect(server[verb as Verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb as Verb].mock.calls.pop();

      const methodPath = {
        get: "detail",
        put: "modify",
        del: "remove",
      }[verb] as "detail" | "modify" | "remove";

      expect(apiPath).toEqual("/users/:id");
      await handler(req, res);
      expect(domain[`user.${methodPath}`].method.mock.calls.length).toBe(1);
      expect(domain[`user.${methodPath}`].method.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: "x-real-ip",
          remoteIp: "127.0.0.1",
          requestId: "this-is-request-id",
          revision: undefined,
          token: "this-is-a-token-by-headers",
          userAgent: "UserAgentString",
          uuid: undefined,
        },
        { access_token: "this-is-a-token-by-query" },
      ]);

      expect(res.send.mock.calls.length).toBe(1);
      if (verb === "get") {
        expect(res.send.mock.calls.pop()).toEqual([200, { name: "redstone" }]);
      } else if (verb === "put") {
        expect(res.send.mock.calls.pop()).toEqual([200, { name: "redstone-modify" }]);
      } else {
        expect(res.send.mock.calls.pop()).toEqual([204]);
      }
    }
  });

  it("model, routePath is defined", async () => {
    router.model("user", "/employees/:id");

    domain["user.detail"].method.mockResolvedValueOnce({ name: "redstone" });
    domain["user.modify"].method.mockResolvedValueOnce({ name: "redstone-modify" });
    domain["user.remove"].method.mockResolvedValueOnce(null);

    for await (const verb of ["get", "put", "del"]) {
      expect(server[verb as Verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb as Verb].mock.calls.pop();

      const methodPath = {
        get: "detail",
        put: "modify",
        del: "remove",
      }[verb] as "detail" | "modify" | "remove";

      expect(apiPath).toEqual("/employees/:id");
      await handler(req, res);
      expect(domain[`user.${methodPath}`].method.mock.calls.length).toBe(1);
      expect(domain[`user.${methodPath}`].method.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: "x-real-ip",
          remoteIp: "127.0.0.1",
          requestId: "this-is-request-id",
          revision: undefined,
          token: "this-is-a-token-by-headers",
          userAgent: "UserAgentString",
          uuid: undefined,
        },
        { access_token: "this-is-a-token-by-query" },
      ]);

      expect(res.send.mock.calls.length).toBe(1);
      if (verb === "get") {
        expect(res.send.mock.calls.pop()).toEqual([200, { name: "redstone" }]);
      } else if (verb === "put") {
        expect(res.send.mock.calls.pop()).toEqual([200, { name: "redstone-modify" }]);
      } else {
        expect(res.send.mock.calls.pop()).toEqual([204]);
      }
    }
  });

  it("resource", async () => {
    router.resource("user");

    domain["user.add"].method.mockResolvedValueOnce({ name: "redstone" });
    domain["user.list"].method.mockResolvedValueOnce({
      count: 999999999999999,
      rows: ["redstone"],
    });
    domain["user.detail"].method.mockResolvedValueOnce({ name: "redstone" });
    domain["user.modify"].method.mockResolvedValueOnce({ name: "redstone-modify" });
    domain["user.remove"].method.mockResolvedValueOnce(null);

    for await (const verb of ["post", "put", "del"]) {
      expect(server[verb as Verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb as Verb].mock.calls.pop();

      const methodPath = {
        post: "add",
        put: "modify",
        del: "remove",
      }[verb] as "add" | "modify" | "remove";

      if (verb === "post") {
        expect(apiPath).toEqual("/users");
      } else {
        expect(apiPath).toEqual("/users/:id");
      }
      await handler(req, res);
      expect(domain[`user.${methodPath}`].method.mock.calls.length).toBe(1);
      expect(domain[`user.${methodPath}`].method.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: "x-real-ip",
          remoteIp: "127.0.0.1",
          requestId: "this-is-request-id",
          revision: undefined,
          token: "this-is-a-token-by-headers",
          userAgent: "UserAgentString",
          uuid: undefined,
        },
        { access_token: "this-is-a-token-by-query" },
      ]);

      expect(res.send.mock.calls.length).toBe(1);
      if (verb === "post") {
        expect(res.send.mock.calls.pop()).toEqual([201, { name: "redstone" }]);
      } else if (verb === "put") {
        expect(res.send.mock.calls.pop()).toEqual([200, { name: "redstone-modify" }]);
      } else {
        expect(res.send.mock.calls.pop()).toEqual([204]);
      }
    }

    expect(server.get.mock.calls.length).toBe(2);

    // detail
    await (async () => {
      const [apiPath, handler] = server.get.mock.calls.pop();

      expect(apiPath).toEqual("/users/:id");
      await handler(req, res);
      expect(domain["user.detail"].method.mock.calls.length).toBe(1);
      expect(domain["user.detail"].method.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: "x-real-ip",
          remoteIp: "127.0.0.1",
          requestId: "this-is-request-id",
          revision: undefined,
          token: "this-is-a-token-by-headers",
          userAgent: "UserAgentString",
          uuid: undefined,
        },
        { access_token: "this-is-a-token-by-query" },
      ]);

      expect(res.send.mock.calls.length).toBe(1);
      expect(res.send.mock.calls.pop()).toEqual([200, { name: "redstone" }]);
    })();

    // list
    await (async () => {
      const [apiPath, handler] = server.get.mock.calls.pop();

      expect(apiPath).toEqual("/users");
      await handler(req, res);
      expect(domain["user.list"].method.mock.calls.length).toBe(1);
      expect(domain["user.list"].method.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: "x-real-ip",
          remoteIp: "127.0.0.1",
          requestId: "this-is-request-id",
          revision: undefined,
          token: "this-is-a-token-by-headers",
          userAgent: "UserAgentString",
          uuid: undefined,
        },
        { access_token: "this-is-a-token-by-query" },
      ]);

      expect(res.send.mock.calls.length).toBe(1);
      expect(res.send.mock.calls.pop()).toEqual([200, ["redstone"]]);
      expect(res.header.mock.calls.pop()).toEqual(["X-Content-Record-Total", 999999999999999]);
    })();
  });

  it("Missing domain method", async () => {
    expect(() => {
      router.get("/home", "user.welcome");
    }).toThrow("Missing");
  });

  it("params handler exists", async () => {
    const paramsHandler = jest.fn();
    const resHandler = jest.fn();
    domain["home.index"].method.mockResolvedValueOnce({
      count: 999999999999999,
      rows: ["redstone"],
    });
    router.get("/home", "home.index", 205, true, paramsHandler, resHandler);

    domain["home.index"].method.mockResolvedValueOnce({ name: "redstone" });

    expect(server.get.mock.calls.length).toBe(1);
    const [apiPath, handler] = server.get.mock.calls.pop();

    expect(apiPath).toEqual("/home");
    await handler(req, res);
    expect(domain["home.index"].method.mock.calls.length).toBe(1);
    expect(domain["home.index"].method.mock.calls.pop()).toMatchObject([
      {
        clientIp: "x-forwarded-for-ip",
        realIp: "x-real-ip",
        remoteIp: "127.0.0.1",
        requestId: "this-is-request-id",
        revision: undefined,
        token: "this-is-a-token-by-headers",
        userAgent: "UserAgentString",
        uuid: undefined,
      },
      { access_token: "this-is-a-token-by-query" },
    ]);

    expect(resHandler.mock.calls.length).toBe(1);
    expect(resHandler.mock.calls.pop()).toEqual([
      { count: 999999999999999, rows: ["redstone"] },
      res,
      { access_token: "this-is-a-token-by-query" },
    ]);
  });
  */
});
