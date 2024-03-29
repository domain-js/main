import { Opt as Sign } from "../deps/signer";

export interface Cnf {
  proxyIps?: string;
  port?: number;
  host?: string;
  bodyMaxBytes?: number;
  apisRoute?: string;
  socket?: boolean;
  fileUploadMultiple?: boolean; // 是否支持多文件上传
  [propName: string]: any;
}

export interface Profile {
  /** 操作涉及到的资源名称 */
  resource?: string;
  verb?: string;
  clientIp: string;
  remoteIp: string;
  realIp: string;
  userAgent: string;
  startedAt: Date;
  requestId: string;
  method: string;
  /** 用户类型，例如 user, worker */
  type: string;
  /** 自由挂载信息的节点 */
  extra: Record<string, any>;
  revision?: string;
  uuid?: string;
  token?: string;
  sign?: Sign & { signature: string };
  isSocket?: boolean;
  /** socket 的时候加入的房间 */
  roomId?: string;
  /** 是否需要返回 stream */
  needStream?: boolean;
}

export interface HttpCodes {
  [propName: string]: number;
}

export interface Domain {
  [propName: string]: {
    /** 领域方法第一个参数 schema 定义 */
    profile: any;
    /** 领域方法第二个参数 schema 定义 */
    params: any;
    /** 领域方法 */
    method: (profile: any, params?: any) => any;
  };
}

export interface Err {
  message: string;
  code?: number | string;
  data?: any;
}
