export interface Cnf {
  proxyIps?: string;
  port?: number;
  host?: string;
  bodyMaxBytes?: number;
  apisRoute?: string;
  socket?: boolean;
  [propName: string]: any;
}

interface Sign {
  signature: string;
  uri: string;
  key: string;
  timestamp: number;
  signMethod: string;
  signVersion: string;
  method: string;
}

export interface Profile {
  clientIp: string;
  remoteIp: string;
  realIp: string;
  userAgent: string;
  startedAt: Date;
  requestId: string;
  /** 自由挂载信息的节点 */
  extra: Record<string, any>;
  revision?: string;
  uuid?: string;
  token?: string;
  sign?: Sign;
  isSocket?: boolean;
  /** socket 的时候加入的房间 */
  roomId?: string;
}

export interface HttpCodes {
  [propName: string]: number;
}

export interface Domain {
  [propName: string]: (profile: Profile, params: any) => any | Domain;
}

export type GetSchemaByPath = (methodPath: string) => [any, any];

export interface Err {
  message: string;
  code?: number | string;
  data?: any;
}
