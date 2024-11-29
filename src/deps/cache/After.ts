// import { SetRequired } from "type-fest";
import { Cache, CnfDef, DepsDef, PubSubDef } from "./Define";

export const After = (
  lru: Pick<Cache, "del">,
  cnf: CnfDef,
  deps: Pick<DepsDef, "logger">,
  pubsub?: PubSubDef,
) => {
  const { cache = {} } = cnf;
  const { isMulti = false, delSignalChannel = "LRU_DEL_SIGNAL_CHANNEL" } = cache;
  // 如果不是多节点分部署部署，则不需要处理
  // 开启多节点分布式部署后，要通过redis广播cache的del事件，以此来保持cache的有效性
  if (!isMulti || !pubsub) return;

  const { logger } = deps;
  const { pub, sub } = pubsub;

  sub.subscribe(delSignalChannel, (err: Error | null | undefined, count: unknown) => {
    logger.info("cache.redis.subscribe", { chanels: delSignalChannel, count });
    if (err) return logger.error(err);
    return logger.info(`cache.redis.subscribe succeed, channel count: ${count}`);
  });

  const del = lru.del.bind(lru);
  lru.del = (key) => {
    del(key);
    pub.publish(delSignalChannel, key);
  };

  sub.on("message", async (channel: string, key: string) => {
    if (channel === delSignalChannel) del(key);
  });
};
