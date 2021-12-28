import * as crypto from "crypto";

/** Objects to be encrypted */
export interface Opt {
  /** The URI does not contain the root path part */
  uri: string;
  /** Key for signature calculation */
  key: string;
  /** Second timestamp */
  timestamp: number;
  /** Signature algorithm, fixed as hmacsha256 */
  signMethod: "HmacSHA256";
  /** Signature version, fixed as 1 */
  signVersion: "1";
  /** Method name of the request interface, internal domain method name, not HTTP verb */
  method: string;
}

/**
 * API interface encryption signature algorithm module, based on sha256
 * @returns generator And request Methods
 */
export function Main() {
  /**
   * API interface encryption signature algorithm module, based on sha256
   */
  const returns = {
    /**
     * Core encryption algorithm, the result is returned as Base64 string
     * @param opt Objects to be encrypted
     * @param secret Calculate the private key of the signature
     * @returns The result of the signature is in the format of Base64 string
     */
    generator(opt: Opt, secret: string) {
      const string = Object.keys(opt)
        .map((k) => `${k}=${encodeURIComponent(opt[k as keyof Opt])}`)
        .sort()
        .join("&");
      const h = crypto.createHmac("sha256", secret);
      return h.update(string).digest("base64");
    },

    /**
     * Get all the signature encryption information required for a request
     * @param uri The URI does not contain the root path part
     * @param method Method name of the request interface, internal domain method name not HTTP verb
     * @param key Key for signature calculation
     * @param secret Calculate the private key of the signature
     * @returns
     */
    request(uri: string, method: string, key: string, secret: string) {
      const opt: Opt = {
        uri,
        key,
        timestamp: (Date.now() / 1000) | 0,
        signMethod: "HmacSHA256",
        signVersion: "1",
        method,
      };

      const signature = returns.generator(opt, secret);

      return {
        "x-auth-signature": signature,
        "x-auth-key": key,
        "x-auth-method": method,
        "x-auth-timestamp": opt.timestamp as unknown as string,
        "x-auth-sign-method": opt.signMethod,
        "x-auth-sign-version": opt.signVersion,
      } as const;
    },
  };

  return returns;
}

export const Deps = [];
