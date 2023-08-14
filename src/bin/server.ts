import { Readable } from "stream";

import { Main as Http } from "../http";
import { Domain, Profile } from "../http/defines";
import { NarrowDomainPaths } from "../http/router";

(async () => {
  const services: Domain = {
    "home.index": {
      profile: {},
      params: {},
      method: async (profile: Profile, params: any) => {
        return { profile, params };
      },
    },
    stream: {
      profile: {},
      params: {},
      method: async (profile: Profile, params: any) => {
        class TimeStream extends Readable {
          public count: number;
          public timer: ReturnType<typeof setInterval>;

          constructor(options = {}) {
            super(options);
            this.count = 0;
            this.timer = setInterval(() => {
              this.push(new Date().toISOString() + "\n");
              this.count++;
              if (this.count === 5) {
                clearInterval(this.timer);
                this.push(null);
              }
            }, 1000);
          }

          _read() {}
        }

        const timeStream = new TimeStream();
        timeStream.pipe(process.stdout);

        return timeStream;
      },
    },
  };

  const routers = (r: NarrowDomainPaths<"home.index" | "stream">) => {
    r.get("/", "home.index");
    r.get("/stream", "stream");
  };

  const Start = Http(
    {
      port: 3009,
    },
    {
      domain: services,
      httpCodes: {},
      routers,
    },
  );
  const server = Start();

  server.server.setTimeout(1000 * 60 * 5);
})();
