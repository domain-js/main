import _ from "lodash";
import { Server, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

import { Opt as Sign } from "../deps/signer";
import { Domain, Profile } from "./defines";

type Signature = Sign & { signature: string };

const proxyIps = new Set(["127.0.0.1"]);

interface MyError {
  code: string | number;
  message: string;
  data?: any;
}

class MyError extends Error {
  code!: string | number;
  message!: string;
  data?: any;

  constructor(code: string | number, message: string, data?: any) {
    super(message);

    this.code = code;
    this.data = data;
  }
}

export type Listener = Client["emit"] & {
  roomId?: string;
};

type Client = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> & {
  profile?: ReturnType<typeof makeProfile>;
  listener?: Listener;
};

const utils = {
  /** 真实的连接请求端ip */
  remoteIp(client: Client) {
    return client.handshake.address;
  },

  /**
   * 获取客户端真实ip地址
   */
  clientIp(client: Client) {
    const { headers } = client.handshake;
    const clientIp = headers["x-forwarded-for"] || headers["x-real-ip"] || utils.remoteIp(client);
    if (Array.isArray(clientIp)) return clientIp[0];
    return clientIp.split(",")[0];
  },

  /**
   * 获取可信任的真实ip
   */
  realIp(client: Client) {
    const remoteIp = utils.remoteIp(client);
    if (!proxyIps.has(remoteIp)) return remoteIp;
    const realIp = client.handshake.headers["x-real-ip"] || remoteIp;
    if (Array.isArray(realIp)) return realIp[0];
    return realIp.split(",")[0];
  },
};

const makeProfile = (
  client: Client,
  auth: string | Signature,
  params: any,
  extra: Profile["extra"],
) => {
  const obj: Profile = {
    clientIp: utils.clientIp(client),
    remoteIp: utils.remoteIp(client),
    realIp: utils.realIp(client),
    isSocket: true,
    startedAt: new Date(),
    userAgent: client.handshake.headers["user-agent"] || "Not captured",
    requestId: client.id,
    /** 客户端发布号 */
    revision: params.revision,
    /** 用户uuid 可以长期跨app */
    uuid: params.uuid,
    /** 额外信息，自由扩展 */
    extra,
  };
  if (typeof auth === "string") {
    obj.token = auth;
  } else {
    obj.sign = auth;
    obj.sign.uri = "/socket.io";
    obj.sign.method = "socket.init";
  }

  return obj;
};

export function BridgeSocket(io: Server, domain: Domain) {
  const subscribe = _.get(domain, "message.subscribe");
  const unsubscribe = _.get(domain, "message.unsubscribe");
  const entrance = _.get(domain, "message.entrance");

  if (!subscribe)
    throw Error("要启用 socket 服务，必须要要有 message.subscribe 方法，用来处理 socket 订阅");
  if (!unsubscribe)
    throw Error("要启用 socket 服务，必须要要有 message.unsubscribe 方法，用来处理 socket 退订");
  if (!entrance)
    throw Error("要启用 socket 服务，必须要要有 message.entrance 方法，用来处理 加入某个房间");

  io.on("connection", (client: Client) => {
    console.log("[%s] connection: client.id: %s", new Date(), client.id);
    client.on("init", async (auth: string | Signature, params, extra) => {
      console.log("[%s] socket.init: client.id: %s", new Date(), client.id);
      if (!auth) {
        client.emit("initError", "auth info lost");
        return;
      }

      try {
        Object.assign(client, { profile: makeProfile(client, auth, params, extra) });
        if (!client.profile) throw new MyError("noAuth", "请先登录");
        // 创建消息监听函数
        if (!client.listener) client.listener = client.emit.bind(client);
        // 向领域注册改用户的监听函数
        const session = subscribe(client.profile, client.listener);

        client.emit("inited", session);
      } catch (e) {
        if (e instanceof MyError) {
          client.emit("internalError", e.message, e.code || "unknown");
          return;
        }
        console.error(e);
      }
    });

    client.on("entrance", async (roomId: string) => {
      try {
        if (!client.profile || !client.listener) return;
        const res = await entrance({ roomId, ...client.profile }, client.listener);
        client.profile.roomId = roomId;
        client.listener.roomId = roomId;
        client.emit("entranced", res);
      } catch (e) {
        if (e instanceof MyError) {
          client.emit("internalError", e.message, e.code || "unknown");
          return;
        }
        console.error(e);
      }
    });

    client.use(async ([name, params, responseId], next) => {
      if (name === "init" || name === "entrance") return next();

      const method = domain[name];
      try {
        if (!method) throw new MyError("notFound", "不存在该领域方法");
        if (!client.profile) throw new MyError("noAuth", "请先执行 init");
        const res = await method(client.profile, params);
        if (responseId) {
          client.emit("response", responseId, res);
        }
      } catch (e) {
        if (e instanceof Error) {
          if (responseId) {
            client.emit("responseError", responseId, (e as any).code, e.message, (e as any).data);
          } else {
            client.emit(`${name}Error`, (e as any).code, e.message, (e as any).data);
          }
        } else {
          console.error(e);
        }
      }
      return next();
    });

    // 掉线
    client.on("disconnect", () => {
      if (!client.profile) return;
      if (!client.listener) return;
      // 这里要取消对领域消息的监听
      unsubscribe(client.profile, client.listener);
    });
  });
}
