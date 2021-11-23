import { Main, Http, DM, utils } from "..";

describe("@domain.js/main index", () => {
  describe("test1", () => {
    it("case1", () => {
      expect(typeof Main).toBe("function");
      expect(typeof Http).toBe("function");
      expect(typeof DM.auto).toBe("function");
      expect(typeof DM.exec).toBe("function");
      expect(typeof utils).toBe("object");
    });
  });
});
