import { AxiosError } from "axios";
import { Main } from "..";
import { sleep } from "../../../utils";

describe("axios module", () => {
  describe("cnf.axios exists", () => {
    const cnf = {
      axios: {
        loggers: ["post", "world"],
        retryIntervalMS: 20,
        retrys: ["post", "delete", "hello"],
      },
    };

    const deps = {
      axios: {
        create: jest.fn(),
        get: jest.fn(),
      },
      logger: {
        logger: jest.fn((x) => x),
        info: jest.fn(),
        error: jest.fn(),
      },
      utils: {
        sleep: jest.fn(sleep),
      },
    };
    const post = jest.fn();
    const put = jest.fn();
    const deleteFn = jest.fn();
    const instance = {
      post,
      put,
      get: jest.fn(),
      patch: jest.fn(),
      delete: deleteFn,
    };
    deps.axios.create.mockReturnValueOnce(instance);
    const _axios = Main(cnf, deps);
    it("case1", async () => {
      instance.get.mockResolvedValueOnce("ok");

      expect(deps.logger.logger.mock.calls.length).toBe(1);
      const [fn, name, isAsync, transferm, errorHandler] =
        deps.logger.logger.mock.calls.pop() as any;
      expect(fn).toBe(post);
      expect(fn).not.toBe(instance.post);
      expect(name).toBe("axios.post");
      expect(isAsync).toBe(true);
      expect(transferm({ data: "hello" })).toBe("hello");

      const e1: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        config: {},
        toJSON: jest.fn(() => ({ value: "hello world" })),
        isAxiosError: false,
      });
      expect(errorHandler(e1)).toEqual("no-response\thas error");

      const e2: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        response: {
          status: 403,
          statusText: "Forbidden",
          data: "",
          headers: {},
          config: {},
        },
        config: {},
        toJSON: jest.fn(() => ({ value: "hello world" })),
        isAxiosError: false,
      });
      expect(errorHandler(e2)).toEqual("403\tForbidden");

      const e3: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        response: {
          status: 403,
          statusText: "Forbidden",
          data: "You has been blocked",
          headers: {},
          config: {},
        },
        config: {},
        toJSON: jest.fn(() => ({ value: "hello world" })),
        isAxiosError: false,
      });
      expect(errorHandler(e3)).toEqual("403\tYou has been blocked");

      const e4: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        response: {
          status: 403,
          statusText: "Forbidden",
          data: {
            code: "Dont allowed",
            message: "Dont allowed.",
          },
          headers: {},
          config: {},
        },
        config: {},
        toJSON: jest.fn(() => ({ value: "hello world" })),
        isAxiosError: false,
      });
      expect(errorHandler(e4)).toEqual("Dont allowed\tDont allowed.");

      const e5: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        response: {
          status: 403,
          statusText: "Forbidden",
          data: {
            message: "Dont allowed.",
          },
          headers: {},
          config: {},
        },
        config: {},
        toJSON: jest.fn(() => ({ value: "hello world" })),
        isAxiosError: false,
      });
      expect(errorHandler(e5)).toEqual("403\tDont allowed.");

      const e6: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        response: {
          status: 403,
          statusText: "Forbidden",
          data: {
            code: "Dont allowed",
          },
          headers: {},
          config: {},
        },
        config: {},
        toJSON: jest.fn(() => ({ value: "hello world" })),
        isAxiosError: false,
      });
      expect(errorHandler(e6)).toEqual("Dont allowed\tForbidden");

      expect(typeof _axios.get).toBe("function");
      expect(await _axios.get("http://xiongfei.me/")).toBe("ok");

      expect(_axios.origin).toBe(deps.axios);
    });

    it("case2", async () => {
      const e: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        config: {},
        toJSON: jest.fn(),
        isAxiosError: false,
      });
      put.mockRejectedValueOnce(e);
      await expect(_axios.put("http://xiongfei.me/")).rejects.toThrow("has error");
    });

    it("case3", async () => {
      const e: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        code: "ETIMEDOUT",
        config: {},
        toJSON: jest.fn(),
        isAxiosError: false,
      });
      deleteFn.mockRejectedValueOnce(e).mockResolvedValueOnce("hello world");
      await expect(_axios.delete("http://xiongfei.me/errors/123")).resolves.toEqual("hello world");
    });

    it("case4", async () => {
      const e: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        code: "ETIMEDOUT",
        config: {},
        toJSON: jest.fn(),
        isAxiosError: false,
      });
      deleteFn.mockRejectedValueOnce(e).mockRejectedValueOnce(e).mockRejectedValueOnce(e);
      await expect(_axios.delete("http://xiongfei.me/errors/123")).rejects.toThrow("has error");
    });

    it("case5", async () => {
      const e: AxiosError = Object.assign(new Error("has error"), {
        name: "Internal error",
        config: {},
        toJSON: jest.fn(),
        isAxiosError: false,
      });
      deleteFn.mockRejectedValueOnce(e);
      await expect(_axios.delete("http://xiongfei.me/errors/123")).rejects.toThrow("has error");
    });
  });

  describe("cnf.axios non-exists", () => {
    const cnf = {};

    const deps = {
      axios: {
        create: jest.fn(),
        get: jest.fn(),
      },
      logger: {
        logger: jest.fn((x) => x),
        info: jest.fn(),
        error: jest.fn(),
      },
      utils: {
        sleep: jest.fn(sleep),
      },
    };
    const post = jest.fn();
    const put = jest.fn();
    const deleteFn = jest.fn();
    const instance = {
      post,
      put,
      get: jest.fn(),
      patch: jest.fn(),
      delete: deleteFn,
    };
    deps.axios.create.mockReturnValueOnce(instance);
    const _axios = Main(cnf, deps);
    it("case1", () => {
      expect(typeof _axios.get).toBe("function");
    });
  });
});
