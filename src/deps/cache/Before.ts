import * as Redis from "ioredis";
import { CnfDef, DepsDef, PubSubDef } from "./Define";

type returns = [CnfDef, DepsDef, PubSubDef?];

export const Before = (cnf: CnfDef, deps: DepsDef): returns => {
  const { cache = {}, redis } = cnf;
  const { isMulti = false } = cache;

  if (!isMulti) return [cnf, deps];

  // 如果不是多节点分部署部署，则不需要处理
  // 开启多节点分布式部署后，要通过redis广播cache的del事件，依次来保持cache的有效性
  const pub = new Redis(redis);
  const sub = new Redis(redis);

  return [cnf, deps, { pub, sub }];
};
