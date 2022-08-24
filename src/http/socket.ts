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

export type Client = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> & {
  profile?: ReturnType<typeof makeProfile>;
  inited?: boolean;
  roomId?: string;
  methods?: Record<string, Function>;
  operator?: any;
  /** 退出房间回调函数 */
  quit?: Function;
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
  type = "user",
  auth: string | Signature,
  extra: Profile["extra"] = {},
) => {
  const obj: Profile = {
    clientIp: utils.clientIp(client),
    remoteIp: utils.remoteIp(client),
    realIp: utils.realIp(client),
    method: "None",
    isSocket: true,
    startedAt: new Date(),
    userAgent: client.handshake.headers["user-agent"] || "Not captured",
    requestId: client.id,
    type,
    extra,
  };
  if (extra) {
    /** 客户端发布号 */
    if (extra.revision) obj.revision = extra.revision;
    /** 用户uuid 可以长期跨app */
    if (extra.uuid) obj.uuid = extra.uuid;
  }
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
  const { method: subscribe } = domain["socket.subscribe"];
  const { method: unsubscribe } = domain["socket.unsubscribe"];
  const { method: entrance } = domain["socket.entrance"];

  if (!subscribe)
    throw Error("要启用 socket 服务，必须要要有 socket.subscribe 方法，用来处理 socket 订阅");
  if (!unsubscribe)
    throw Error("要启用 socket 服务，必须要要有 socket.unsubscribe 方法，用来处理 socket 退订");
  if (!entrance)
    throw Error("要启用 socket 服务，必须要要有 socket.entrance 方法，用来处理 加入某个房间");

  io.on("connection", (client: Client) => {
    // 定义toJSON 避免 schema 验证报错
    Object.assign(client, {
      toJSON() {
        return {};
      },
    });
    console.log("[%s] connection: client.id: %s", new Date(), client.id);
    client.on("init", async (type: string, auth: string | Signature, extra = {}) => {
      console.log("[%s] socket.init: client.id: %s", new Date(), client.id);
      if (!auth) {
        client.emit("initError", "auth info lost");
        return;
      }

      try {
        Object.assign(client, { profile: makeProfile(client, type, auth, extra) });
        if (!client.profile) throw new MyError("noAuth", "请先登录");
        // 创建消息监听函数
        if (!client.inited) client.inited = true;
        // 向领域注册改用户的监听函数
        const session = await subscribe(client.profile, client);

        client.emit("inited", session);
      } catch (e: any) {
        client.inited = false;
        client.emit("internalError", e.code || "unknown", e.message, e.data);
        console.error(e);
      }
    });

    client.on("entrance", async (roomId: string) => {
      try {
        if (!client.profile || !client.inited) return;
        const ret = await entrance({ ...client.profile, roomId }, client);
        client.profile.roomId = roomId;
        client.roomId = roomId;
        Object.assign(client, ret);
        client.emit("entranced", { ...ret, methods: Object.keys(ret.methods) });
      } catch (e: any) {
        client.emit("internalError", e.code || "unknown", e.message, e.data);
        console.error(e);
      }
    });

    client.use(async ([name, params, responseId], next) => {
      if (name === "init" || name === "entrance") return next();

      if (!client.methods) throw new MyError("没有允许执行的方法", "请先进入房间");
      const method = client.methods[name];
      try {
        if (!method) throw new MyError("notFound", "不存在该领域方法");
        if (!client.profile) throw new MyError("noAuth", "请先执行 init");
        const res = await method(...params);
        if (responseId) {
          client.emit("response", responseId, res);
        }
      } catch (e: any) {
        if (responseId) {
          client.emit("responseError", responseId, e.code, e.message, e.data);
        } else {
          client.emit(`${name}Error`, e.code, e.message, e.data);
        }
      }
      return next();
    });

    // 掉线
    client.on("disconnect", async () => {
      if (!client.profile) return;
      if (!client.inited) return;
      // 这里要取消对领域消息的监听
      try {
        return await unsubscribe(client.profile, client);
      } catch (e) {
        console.error(e);
      }
    });
  });
}
