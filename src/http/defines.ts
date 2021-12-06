export interface Cnf {
  proxyIps?: string;
  port?: number;
  host?: string;
  bodyMaxBytes?: number;
  apisRoute?: string;
  swaggerApiPath?: string;
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
  revision?: string;
  uuid?: string;
  token?: string;
  sign?: Sign;
}

export interface HttpCodes {
  [propName: string]: number;
}

export interface Domain {
  [propName: string]: (profile: Profile, params: any) => any | Domain;
}

export interface GetSchemaByPath {
  (methodPath: string): [any, any];
}

export interface Err {
  message: string;
  code?: number | string;
  data?: any;
}
