import * as LRU from "lru-cache";
import * as Redis from "ioredis";
import { SetRequired } from "type-fest";

export interface CnfDef {
  cache?: {
    isMulti?: boolean;
    delSignalChannel?: string;
  } & LRU.Options<string, string>;
  redis?: any;
}

export interface DepsDef {
  logger: {
    info(message: string, extra?: any): void;
    error(error: Error, extra?: any): void;
  };
}

export interface PubSubDef {
  pub: SetRequired<Partial<Redis.Redis>, "publish">;
  sub: SetRequired<Partial<Redis.Redis>, "on" | "subscribe">;
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
