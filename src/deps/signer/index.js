const crypto = require("crypto");

function Main() {
  const generator = (_opt, secret) => {
    const opt = { ..._opt, signMethod: "HmacSHA256", signVersion: "1" };
    const string = Object.keys(opt)
      .map((k) => `${k}=${encodeURIComponent(opt[k])}`)
      .sort()
      .join("&");
    const h = crypto.createHmac("sha256", secret);
    return h.update(string).digest("base64");
  };

  const request = (uri, method, key, secret) => {
    const opt = {
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

Main.Deps = [];

module.exports = Main;
