import * as AES from "..";

describe("AES", () => {
  const aes = AES.Main();
  const key = "AES_KEY";
  describe("encrypt", () => {
    it("case1", () => {
      const msg = aes.encrypt("hello world", key);
      expect(typeof msg).toBe("string");

      expect(aes.decrypt(msg, key)).toBe("hello world");
    });
  });
});
