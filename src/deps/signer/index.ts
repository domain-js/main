import * as crypto from "crypto";

interface Opt {
  uri: string;
  key: string;
  timestamp: number;
  signMethod: "HmacSHA256";
  signVersion: "1";
  method: string;
}

export function Main() {
  const generator = (opt: Opt, secret: string) => {
    const string = Object.keys(opt)
      .map((k) => `${k}=${encodeURIComponent(opt[k as keyof Opt])}`)
      .sort()
      .join("&");
    const h = crypto.createHmac("sha256", secret);
    return h.update(string).digest("base64");
  };

  const request = (uri: string, method: string, key: string, secret: string) => {
    const opt: Opt = {
      uri,
      key,
      timestamp: (Date.now() / 1000) | 0,
      signMethod: "HmacSHA256",
      signVersion: "1",
      method,
    };

    const signature = generator(opt, secret);

    return {
      "x-auth-signature": signature,
      "x-auth-key": key,
      "x-auth-method": method,
      "x-auth-timestamp": opt.timestamp,
      "x-auth-sign-method": opt.signMethod,
      "x-auth-sign-version": opt.signVersion,
    };
  };

  return { generator, request };
}

export const Deps = [];
