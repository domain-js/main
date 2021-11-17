const Router = require("../router");

const server = {};

for (const verb of ["get", "post", "put", "patch", "del"]) {
  server[verb] = jest.fn();
}
const domain = {
  home: {
    index: jest.fn(),
    add: jest.fn(),
    list: jest.fn(),
  },
  user: {
    detail: jest.fn(),
    modify: jest.fn(),
    remove: jest.fn(),
    list: jest.fn(),
    add: jest.fn(),
    files: jest.fn(),
    addFile: jest.fn(),
  },
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
  id() {
    return "this-is-request-id";
  },
};

const res = {
  header: jest.fn(),
  send: jest.fn(),
};
const next = jest.fn();

describe("router", () => {
  const router = Router(server)(domain);
  server.get.mock.calls.length = 0;

  for (const verb of ["get", "post", "put", "del"]) {
    it(verb, async () => {
      router[verb]("/home", "home.index");

      domain.home.index.mockResolvedValueOnce({ name: "redstone" });

      expect(server[verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb].mock.calls.pop();
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
      expect(domain.home.index.mock.calls.length).toBe(1);
      expect(domain.home.index.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: undefined,
          remoteIp: undefined,
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

    domain.home.list.mockResolvedValueOnce({ count: 1000, rows: [1, 2, 3] });
    domain.home.add.mockResolvedValueOnce({ name: "redstone-list" });

    for await (const verb of ["get", "post"]) {
      expect(server[verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb].mock.calls.pop();

      const methodPath = verb === "get" ? "list" : "add";
      expect(apiPath).toEqual("/homes");
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
      expect(domain.home[methodPath].mock.calls.length).toBe(1);
      expect(domain.home[methodPath].mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: undefined,
          remoteIp: undefined,
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
    router.collection("file", null, "user");

    domain.user.files.mockResolvedValueOnce({ count: 1000, rows: [1, 2, 3] });
    domain.user.addFile.mockResolvedValueOnce({ name: "redstone-list" });

    for await (const verb of ["get", "post"]) {
      expect(server[verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb].mock.calls.pop();

      const methodPath = verb === "get" ? "files" : "addFile";
      expect(apiPath).toEqual("/users/:userId/files");
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
      expect(domain.user[methodPath].mock.calls.length).toBe(1);
      expect(domain.user[methodPath].mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: undefined,
          remoteIp: undefined,
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
    router.collection("file", "/users/files", "user");

    domain.user.files.mockResolvedValueOnce({ count: 1000, rows: [1, 2, 3] });
    domain.user.addFile.mockResolvedValueOnce({ name: "redstone-list" });

    for await (const verb of ["get", "post"]) {
      expect(server[verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb].mock.calls.pop();

      const methodPath = verb === "get" ? "files" : "addFile";
      expect(apiPath).toEqual("/users/files");
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
      expect(domain.user[methodPath].mock.calls.length).toBe(1);
      expect(domain.user[methodPath].mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: undefined,
          remoteIp: undefined,
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

    domain.user.detail.mockResolvedValueOnce({ name: "redstone" });
    domain.user.modify.mockResolvedValueOnce({ name: "redstone-modify" });
    domain.user.remove.mockResolvedValueOnce(null);

    for await (const verb of ["get", "put", "del"]) {
      expect(server[verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb].mock.calls.pop();

      const methodPath = {
        get: "detail",
        put: "modify",
        del: "remove",
      }[verb];
      expect(apiPath).toEqual("/users/:id");
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
      expect(domain.user[methodPath].mock.calls.length).toBe(1);
      expect(domain.user[methodPath].mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: undefined,
          remoteIp: undefined,
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

    domain.user.detail.mockResolvedValueOnce({ name: "redstone" });
    domain.user.modify.mockResolvedValueOnce({ name: "redstone-modify" });
    domain.user.remove.mockResolvedValueOnce(null);

    for await (const verb of ["get", "put", "del"]) {
      expect(server[verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb].mock.calls.pop();

      const methodPath = {
        get: "detail",
        put: "modify",
        del: "remove",
      }[verb];
      expect(apiPath).toEqual("/employees/:id");
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
      expect(domain.user[methodPath].mock.calls.length).toBe(1);
      expect(domain.user[methodPath].mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: undefined,
          remoteIp: undefined,
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

    domain.user.add.mockResolvedValueOnce({ name: "redstone" });
    domain.user.list.mockResolvedValueOnce({ count: 999999999999999, rows: ["redstone"] });
    domain.user.detail.mockResolvedValueOnce({ name: "redstone" });
    domain.user.modify.mockResolvedValueOnce({ name: "redstone-modify" });
    domain.user.remove.mockResolvedValueOnce(null);

    for await (const verb of ["post", "put", "del"]) {
      expect(server[verb].mock.calls.length).toBe(1);
      const [apiPath, handler] = server[verb].mock.calls.pop();

      const methodPath = {
        post: "add",
        put: "modify",
        del: "remove",
      }[verb];
      if (verb === "post") {
        expect(apiPath).toEqual("/users");
      } else {
        expect(apiPath).toEqual("/users/:id");
      }
      await handler(req, res, next);
      expect(next.mock.calls.length).toBe(1);
      expect(next.mock.calls.pop()).toEqual([]);
      expect(domain.user[methodPath].mock.calls.length).toBe(1);
      expect(domain.user[methodPath].mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: undefined,
          remoteIp: undefined,
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
      expect(domain.user.detail.mock.calls.length).toBe(1);
      expect(domain.user.detail.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: undefined,
          remoteIp: undefined,
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
      expect(domain.user.list.mock.calls.length).toBe(1);
      expect(domain.user.list.mock.calls.pop()).toMatchObject([
        {
          clientIp: "x-forwarded-for-ip",
          realIp: undefined,
          remoteIp: undefined,
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
    domain.home.index.mockResolvedValueOnce({ count: 999999999999999, rows: ["redstone"] });
    router.get("/home", "home.index", 205, true, paramsHandler, resHandler);

    domain.home.index.mockResolvedValueOnce({ name: "redstone" });

    expect(server.get.mock.calls.length).toBe(1);
    const [apiPath, handler] = server.get.mock.calls.pop();

    expect(apiPath).toEqual("/home");
    await handler(req, res, next);
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls.pop()).toEqual([]);
    expect(domain.home.index.mock.calls.length).toBe(1);
    expect(domain.home.index.mock.calls.pop()).toMatchObject([
      {
        clientIp: "x-forwarded-for-ip",
        realIp: undefined,
        remoteIp: undefined,
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
    ]);
  });
});
