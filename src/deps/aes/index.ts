import * as AES from "crypto-js/aes";
import * as cryptojs from "crypto-js/core";

export function Main() {
  // aes-256-cbc encrypt
  const encrypt = (message: string, key: string) => AES.encrypt(message, key).toString();

  // aes-256-cbc decrypt
  const decrypt = (message: string, key: string) =>
    AES.decrypt(message, key).toString(cryptojs.enc.Utf8);

  return Object.freeze({
    encrypt,
    decrypt,
  });
}
