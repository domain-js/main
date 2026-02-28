import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const OPENSSL_MAGIC = Buffer.from("Salted__", "ascii");
const SALT_LEN = 8;
const KEY_LEN = 32;
const IV_LEN = 16;

/**
 * EVP_BytesToKey compatible with OpenSSL / crypto-js:
 * MD5, one iteration, D_i = MD5(D_{i-1} || password || salt); key then iv.
 */
function evpBytesToKey(
  password: Buffer,
  salt: Buffer,
): {
  key: Buffer;
  iv: Buffer;
} {
  let keyLen = KEY_LEN;
  let ivLen = IV_LEN;
  const key = Buffer.alloc(KEY_LEN);
  const iv = Buffer.alloc(IV_LEN);
  let block = Buffer.alloc(0);

  while (keyLen > 0 || ivLen > 0) {
    const h = createHash("md5");
    h.update(block);
    h.update(password);
    h.update(salt);
    block = h.digest();

    let used = 0;
    if (keyLen > 0) {
      const toCopy = Math.min(keyLen, block.length);
      block.copy(key, KEY_LEN - keyLen, 0, toCopy);
      used = toCopy;
      keyLen -= toCopy;
    }
    if (used < block.length && ivLen > 0) {
      const toCopy = Math.min(ivLen, block.length - used);
      block.copy(iv, IV_LEN - ivLen, used, used + toCopy);
      ivLen -= toCopy;
    }
  }

  return { key, iv };
}

export function Main() {
  // aes-256-cbc encrypt (OpenSSL / crypto-js compatible: Salted__ + salt + ciphertext, base64)
  const encrypt = (message: string, key: string) => {
    const salt = randomBytes(SALT_LEN);
    const pass = Buffer.from(key, "utf8");
    const { key: keyBuf, iv } = evpBytesToKey(pass, salt);
    const cipher = createCipheriv("aes-256-cbc", keyBuf, iv);
    const ciphertext = Buffer.concat([cipher.update(message, "utf8"), cipher.final()]);
    return Buffer.concat([OPENSSL_MAGIC, salt, ciphertext]).toString("base64");
  };

  // aes-256-cbc decrypt
  const decrypt = (message: string, key: string) => {
    const raw = Buffer.from(message, "base64");
    if (raw.length < OPENSSL_MAGIC.length + SALT_LEN) {
      throw new Error("Invalid ciphertext: too short");
    }
    const magic = raw.subarray(0, OPENSSL_MAGIC.length);
    if (!magic.equals(OPENSSL_MAGIC)) {
      throw new Error("Invalid ciphertext: missing OpenSSL Salted__ prefix");
    }
    const salt = raw.subarray(OPENSSL_MAGIC.length, OPENSSL_MAGIC.length + SALT_LEN);
    const ciphertext = raw.subarray(OPENSSL_MAGIC.length + SALT_LEN);
    const pass = Buffer.from(key, "utf8");
    const { key: keyBuf, iv } = evpBytesToKey(pass, salt);
    const decipher = createDecipheriv("aes-256-cbc", keyBuf, iv);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  };

  return Object.freeze({
    encrypt,
    decrypt,
  });
}
