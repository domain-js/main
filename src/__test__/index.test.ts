import { DM, Http, Main, utils } from "..";

describe("@domain.js/main index", () => {
  describe("test1", () => {
    it("case1", () => {
      expect(typeof Main).toBe("function");
      expect(typeof Http).toBe("function");
      expect(typeof DM.auto).toBe("function");
      expect(typeof DM.exec).toBe("function");
      expect(typeof utils).toBe("object");
    });

    it("case2", () => {
      const features = ["aes"] as const;
      const Start = Main(features);

      const deps = Start({});
      expect(typeof deps.aes.encrypt).toBe("function");
      expect(typeof (deps as any).cache).toBe("undefined");
      expect(typeof (deps as any).request).toBe("undefined");
      expect(typeof (deps as any).cia).toBe("undefined");
    });

    it("case3", () => {
      const Start = Main(["aes", "cache"]);

      expect(() => {
        // 使用类型断言来避免类型检查错误
        Start({ cache: { max: 50000, isMulti: true } } as any);
      }).toThrow("conflict");
    });
  });
});
