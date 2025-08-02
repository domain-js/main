import * as crypto from "crypto";

export function Main() {
  // aes-256-cbc encrypt
  const encrypt = (message: string, key: string) => {
    // 生成随机 IV
    const iv = crypto.randomBytes(16);
    // 使用 PBKDF2 从密钥生成固定长度的密钥
    const derivedKey = crypto.pbkdf2Sync(key, "salt", 1000, 32, "sha256");

    // 创建加密器
    const cipher = crypto.createCipheriv("aes-256-cbc", derivedKey, iv);
    cipher.setAutoPadding(true);

    // 加密
    let encrypted = cipher.update(message, "utf8", "hex");
    encrypted += cipher.final("hex");

    // 返回 IV + 加密数据的组合
    const result = iv.toString("hex") + ":" + encrypted;
    return result;
  };

  // aes-256-cbc decrypt
  const decrypt = (message: string, key: string) => {
    try {
      // 分离 IV 和加密数据
      const parts = message.split(":");
      if (parts.length !== 2) {
        throw new Error("Invalid encrypted message format");
      }

      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];

      // 使用相同的 PBKDF2 生成密钥
      const derivedKey = crypto.pbkdf2Sync(key, "salt", 1000, 32, "sha256");

      // 创建解密器
      const decipher = crypto.createDecipheriv("aes-256-cbc", derivedKey, iv);
      decipher.setAutoPadding(true);

      // 解密
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Decryption failed: " + errorMessage);
    }
  };

  return Object.freeze({
    encrypt,
    decrypt,
  });
}
