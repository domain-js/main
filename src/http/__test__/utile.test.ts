import * as restify from "restify";

import { Profile } from "../defines";
import { Utils } from "../utils";

const utils = Utils({});

describe("utils", () => {
  it("makeProfile with http", () => {
    const req = {
      headers: {
        "x-forwarded-for": "x-forwarded-for-ip",
        "x-real-ip": "x-real-ip",
        "x-auth-token": "this-is-a-token-by-headers",
      },
      query: {
        access_token: "this-is-a-token-by-query",
      },
      userAgent() {
        return "UserAgentString";
      },
      socket: {
        remoteAddress: "127.0.0.1",
      },
      id() {
        return "this-is-request-id";
      },
    };

    const customFn = (profile: Profile, req: restify.Request) => {
      const expand = {
        name: "redstone",
        gender: "male",
      };
      return expand;
    };
    const profile = utils.makeProfile(req as unknown as restify.Request, "auth.session", customFn);

    expect(profile.name).toBe("redstone");
    expect(profile.gender).toBe("male");
  });
});
