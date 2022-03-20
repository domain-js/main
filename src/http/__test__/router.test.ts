import { Router } from "../router";
import { Utils } from "../utils";

const server = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  del: jest.fn(),
};

type Verb = "get" | "post" | "put" | "del";

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
  id() {
    return "this-is-request-id";
  },
};

const res = {
  header: jest.fn(),
  send: jest.fn(),
};
const next = jest.fn();

const utils = Utils({});

describe("router", () => {
  const router = Router({
    utils,
    server: server as any,
    httpCodes: {},
    domain: domain as any,
  });
  server.get.mock.calls.length = 0;

  for (const verb of ["get", "post", "put", "del"]) {
    it(verb, async () => {
      router[verb as Verb]("/home", "home.index");

      domain["home.index"].method.mockResolvedValueOnce({ name: "redstone" });

      expect(server[verb as Verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb as Verb].mock.calls.pop();
      if (verb === "put") {
        expect(server.patch.mock.calls.length).toBe(1);
        const [apiPath2, handler2] = server.patch.mock.calls.pop();
        expect(apiPath).toBe(apiPath2);
        expect(handler2).toBeInstanceOf(Function);
      }

      expect(apiPath).toEqual("/home");
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
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

      expect(res.send.mock.calls.length).toBe(1);
      expect(res.send.mock.calls.pop()).toEqual([200, { name: "redstone" }]);
    });
  }

  it("collection", async () => {
    router.collection("home");

    domain["home.list"].method.mockResolvedValueOnce({ count: 1000, rows: [1, 2, 3] });
    domain["home.add"].method.mockResolvedValueOnce({ name: "redstone-list" });

    for await (const verb of ["get", "post"]) {
      expect(server[verb as Verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb as Verb].mock.calls.pop();

      const methodPath = verb === "get" ? "list" : "add";
      expect(apiPath).toEqual("/homes");
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
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
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
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
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
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
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
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
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
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
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
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
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
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
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
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
    await handler(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls.pop()).toEqual([]);
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
});
