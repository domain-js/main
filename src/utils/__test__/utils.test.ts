import * as utils from "..";

describe("@domain.js/utils", () => {
  describe("deepReaddir", () => {
    it("case1", () => {
      const files = utils.deepReaddir(__dirname, new Set(["ts"]));
      expect(files.length).toBe(1);
    });

    it("case2", () => {
      const files = utils.deepReaddir(__dirname, new Set(["jpeg"]));
      expect(files.length).toBe(0);
    });

    it("case3", () => {
      const files = utils.deepReaddir(__dirname, new Set(["ts"]), new Set(["utils.test"]));
      expect(files.length).toBe(0);
    });
  });

  describe("randStr", () => {
    it("case1", async () => {
      const str = utils.randStr(20, "normal");
      expect(typeof str).toBe("string");
      expect(str.length).toBe(20);
    });

    it("case2", async () => {
      const str = utils.randStr(20, "strong");
      expect(typeof str).toBe("string");
      expect(str.length).toBe(20);
    });

    it("case3", async () => {
      const str = utils.randStr(20, "0000");
      expect(str).toBe("0".repeat(20));
      expect(str.length).toBe(20);
    });

    it("caser", async () => {
      const str = utils.randStr(20);
      expect(str.length).toBe(20);
    });
  });

  describe("md5", () => {
    it("case1", () => {
      const str = utils.md5("hello");
      expect(str).toBe("5d41402abc4b2a76b9719d911017c592");
    });

    it("case3", () => {
      const str = utils.md5(12);
      expect(str).toBe("c20ad4d76fe97759aa27a0c99bff6710");
    });

    it("case4", () => {
      const obj = {
        toString() {
          return "hello";
        },
      };
      const str = utils.md5(obj);
      expect(str).toBe("5d41402abc4b2a76b9719d911017c592");
    });
  });

  describe("nt2space", () => {
    it("case1", () => {
      expect(utils.nt2space("a\tb")).toBe("a b");
    });

    it("case2", () => {
      expect(utils.nt2space("a\t\tb")).toBe("a b");
    });

    it("case3", () => {
      expect(utils.nt2space("a\t\tb\nc")).toBe("a b c");
    });

    it("case4", () => {
      expect(utils.nt2space("a\t\tb\nc\rd")).toBe("a b c d");
    });
  });

  describe("sleep", () => {
    it("case1", async () => {
      const start = Date.now();
      await utils.sleep(300);
      expect(Date.now() - start).toBeLessThan(500);
      expect(Date.now() - start).toBeGreaterThan(200);
    });
  });

  describe("ucfirst", () => {
    it("case1", () => {
      expect(utils.ucfirst("redstone")).toBe("Redstone");
    });

    it("case2", () => {
      expect(utils.ucfirst("Redstone")).toBe("Redstone");
    });
  });

  describe("lcfirst", () => {
    it("case1", () => {
      expect(utils.lcfirst("redstone")).toBe("redstone");
    });

    it("case2", () => {
      expect(utils.lcfirst("Redstone")).toBe("redstone");
    });
  });

  describe("inExpired", () => {
    it("case1", () => {
      expect(utils.inExpired(new Date().valueOf() / 1000, 10)).toBe(false);
    });

    it("case2", () => {
      expect(utils.inExpired(new Date(Date.now() - 5000).valueOf() / 1000, 1)).toBe(true);
    });
  });

  describe("modifiyURL", () => {
    const url = "http://xiongfei.me/admin-ui/index.php?test=hi#hello";
    it("case1", () => {
      expect(utils.modifiyURL(url, { name: "redstone" }, ["test", "test1"])).toBe(
        "http://xiongfei.me/admin-ui/index.php?name=redstone#hello",
      );
    });

    it("case2", () => {
      expect(utils.modifiyURL(url, { name: "redstone" }, [])).toBe(
        "http://xiongfei.me/admin-ui/index.php?test=hi&name=redstone#hello",
      );
      expect(utils.modifiyURL(url, { name: "redstone" })).toBe(
        "http://xiongfei.me/admin-ui/index.php?test=hi&name=redstone#hello",
      );
    });

    it("case3", () => {
      expect(utils.modifiyURL(url, undefined, ["test"])).toBe(
        "http://xiongfei.me/admin-ui/index.php#hello",
      );
      expect(utils.modifiyURL(url, undefined, ["test1"])).toBe(
        "http://xiongfei.me/admin-ui/index.php?test=hi#hello",
      );
    });
  });

  describe("tryCatchLog", () => {
    const fn = jest.fn();
    const errorLog = jest.fn();
    const fn1 = utils.tryCatchLog(fn, errorLog);

    it("case1", async () => {
      await fn1("test");
      expect(fn.mock.calls.length).toBe(1);
      expect(fn.mock.calls.pop()).toEqual(["test"]);
      expect(errorLog.mock.calls.length).toBe(0);
    });

    it("case2", async () => {
      fn.mockRejectedValueOnce(Error("has error"));
      await fn1("test");
      expect(fn.mock.calls.length).toBe(1);
      expect(fn.mock.calls.pop()).toEqual(["test"]);
      expect(errorLog.mock.calls.length).toBe(1);
      expect(errorLog.mock.calls.pop()).toEqual([Error("has error")]);
    });
  });

  describe("deepFreeze", () => {
    it("case1", () => {
      const obj = utils.deepFreeze({ name: "redstone" });
      expect(() => {
        (obj as any).name = "stonephp";
      }).toThrow();
      expect(obj).toEqual({ name: "redstone" });
    });

    it("case2", () => {
      const obj = utils.deepFreeze({ person: { name: "redstone" } });
      expect(() => {
        obj.person.name = "stonephp";
      }).toThrow();
      expect(obj).toEqual({ person: { name: "redstone" } });

      console.log(obj.person.name);
    });
  });

  describe("waitFor", () => {
    it("case1, wait 1 seconds", async () => {
      const startAt = Date.now();
      await utils.waitFor(() => startAt < Date.now() - 1000);
      expect(startAt < Date.now() - 1000).toBe(true);
    });

    it("case1, wait 3 seconds", async () => {
      const startAt = Date.now();
      await utils.waitFor(() => startAt < Date.now() - 3000, 200);
      expect(startAt < Date.now() - 3000).toBe(true);
      expect(startAt > Date.now() - 4000).toBe(true);
    });
  });
});
