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

  describe("decrypt1", () => {
    it("case1", () => {
      const msg =
        "U2FsdGVkX1/AsbpJ5O04SsecKpTZz1aBS3D6Ri9mwzRNCGRKzZQ8gOJ217vZqKQZKUYAc7Hixl63XPUNI1Q6M0/wKVCkamrq0qJAFkeFlXjRp1oD39NTjhpgct3eFQoY";
      const key = "76TO6SIlpbh7ngqNMgwDdYre7YPLM4nw";

      expect(aes.decrypt(msg, key)).toBe(
        "5oZ2m1YFkQ7Scu0BrLSw9ODAnTDoAJpHQcbIcV8coNyaHE5N4at5eutPcMpmZAUV",
      );
    });
  });

  describe("decrypt2", () => {
    it("roundtrip: encrypt then decrypt with same key", () => {
      const key = "76TO6SIlpbh7ngqNMgwDdYre7YPLM4nw";
      const plain = "hello world";
      const msg = aes.encrypt(plain, key);

      expect(aes.decrypt(msg, key)).toBe(plain);
    });
  });
});
