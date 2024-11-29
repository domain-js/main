import Redis from "ioredis";
import LRU from "lru-cache";
import { SetRequired } from "type-fest";

export interface CnfDef {
  cache?: {
    isMulti?: boolean;
    delSignalChannel?: string;
  } & LRU.Options<string, string>;
  redis?: any;
}

export interface DepsDef {
  LRU: typeof LRU;
  IORedis: typeof Redis;
  logger: {
    info: (message: string, extra?: any) => void;
    error: (error: Error, extra?: any) => void;
  };
}

export interface PubSubDef {
  pub: SetRequired<Partial<Redis>, "publish">;
  sub: SetRequired<Partial<Redis>, "on" | "subscribe">;
}

export interface Cache extends LRU<string, string> {
  caching: <T extends (...args: any[]) => Promise<any>>(
    func: T,
    life: number,
    getKey: (...args: Parameters<T>) => string,
    hit?: (hited: boolean) => void,
  ) => T;
  hitCount: () => { hits: number; misseds: number };
  needToBroad: boolean;
}
