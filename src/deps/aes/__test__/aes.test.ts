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

    it("should handle empty string", () => {
      const msg = aes.encrypt("", key);
      expect(typeof msg).toBe("string");
      expect(aes.decrypt(msg, key)).toBe("");
    });

    it("should handle special characters", () => {
      const specialMsg = "Hello 世界! @#$%^&*()_+-=[]{}|;':\",./<>?";
      const msg = aes.encrypt(specialMsg, key);
      expect(typeof msg).toBe("string");
      expect(aes.decrypt(msg, key)).toBe(specialMsg);
    });

    it("should handle long text", () => {
      const longMsg =
        "This is a very long message that should be encrypted and decrypted properly. ".repeat(100);
      const msg = aes.encrypt(longMsg, key);
      expect(typeof msg).toBe("string");
      expect(aes.decrypt(msg, key)).toBe(longMsg);
    });

    it("should generate different ciphertext for same plaintext", () => {
      const plaintext = "hello world";
      const msg1 = aes.encrypt(plaintext, key);
      const msg2 = aes.encrypt(plaintext, key);

      // 由于使用了随机 IV，每次加密结果应该不同
      expect(msg1).not.toBe(msg2);

      // 但解密结果应该相同
      expect(aes.decrypt(msg1, key)).toBe(plaintext);
      expect(aes.decrypt(msg2, key)).toBe(plaintext);
    });

    it("should fail decryption with wrong key", () => {
      const msg = aes.encrypt("hello world", key);
      expect(() => aes.decrypt(msg, "WRONG_KEY")).toThrow("Decryption failed");
    });

    it("should fail decryption with invalid format", () => {
      expect(() => aes.decrypt("invalid_format", key)).toThrow("Decryption failed");
    });
  });
});
