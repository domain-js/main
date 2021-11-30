import axios, { AxiosError } from "axios";
import { Main } from "..";
import { sleep } from "../../../utils";

jest.mock("axios");

const instance = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};
(axios.create as ReturnType<typeof jest.fn>).mockReturnValueOnce(instance);

const cnf = {
  axios: {
    loggers: ["post"],
    retryIntervalMS: 20 * 1000,
    retryTimes: 5,
    retrys: ["post", "delete"],
  },
};

const deps = {
  logger: {
    logger: jest.fn((x) => x),
    info: jest.fn(),
    error: jest.fn(),
  },
  utils: {
    sleep: jest.fn(sleep),
  },
};
describe("axios module", () => {
  const _axios = Main(cnf, deps);
  /*
  it("case1", async () => {
    instance.get.mockResolvedValueOnce("ok");

    expect(deps.logger.logger.mock.calls.length).toBe(2);
    expect(typeof (deps.logger.logger.mock.calls.pop() as any)[0]).toBe("function");
    expect(typeof (deps.logger.logger.mock.calls.pop() as any)[0]).toBe("function");
    expect(typeof _axios.get).toBe("function");
    expect(await _axios.get("http://xiongfei.me/")).toBe("ok");

    expect(_axios.origin).toBe(axios);
  });
  */

  it("case2", async () => {
    const e: AxiosError = {
      message: "has error",
      name: "Internal error",
      config: {},
      toJSON: jest.fn(),
      isAxiosError: false,
    };
    instance.get.mockRejectedValueOnce(e);
    console.log("aaaaaaaaaa");
    const res = await _axios.get("http://xiongfei.me/");
    console.log("bbbbbbbbbb: %o", res);
  });
});
