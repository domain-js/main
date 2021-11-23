import * as _ from "lodash";
import * as Sequelize from "sequelize";
import { TModel, Params } from "./defines";
import { Stats } from "./stats";
import { Utils } from "./utils";

export { Before } from "./Before";

type Cnf = Parameters<typeof Utils>[0] & Parameters<typeof Stats>[0];
type Deps = Parameters<typeof Utils>[1] & Parameters<typeof Stats>[1];

type UserId = string | number;
interface CreatorAndClientIp {
  creatorId: UserId;
  clientIp: string;
}

export function Main(cnf: Cnf, deps: Deps, utils: ReturnType<typeof Utils>) {
  const { errors } = deps;
  const { findAllOpts, pickParams } = utils;

  const modify = (
    Model: TModel,
    model: Sequelize.Model,
    params: Params,
    isAdmin = false,
    _cols?: string[],
  ) => {
    const cols = _cols || Model.editableCols || Model.writableCols || [];
    const attr = pickParams(params, cols, Model, isAdmin);

    // 避免id 被篡改，强制删除id属性
    if (attr.id) delete attr.id;

    Object.assign(model, attr);

    return model.save();
  };

  const add = async (
    Model: TModel,
    params: Params,
    isAdmin = false,
    _cols: string[] | undefined,
    { creatorId, clientIp }: CreatorAndClientIp,
  ) => {
    const cols = _cols || Model.writableCols || [];
    const attr = pickParams(params, cols, Model, isAdmin);

    if (Model.rawAttributes.creatorId) attr.creatorId = creatorId;
    if (Model.rawAttributes.clientIp) attr.clientIp = clientIp;

    // 如果没有设置唯一属性且开启回收站, 则直接添加
    if (!(Model.unique && Model.rawAttributes.isDeleted)) return (Model as any).create(attr);

    // 如果设置了唯一属性，且开启了回收站功能
    // 则判断是否需要执行恢复操作
    const where = _.pick(attr, Model.unique);
    // 根据条件查找资源
    const model = await (Model as any).findOne({ where });
    // 资源不存在
    if (!model) return (Model as any).create(attr);

    // 资源存在但是并非已删除的，抛出资源重复添加的error
    if (model.isDeleted === "no") throw errors.resourceDuplicateAdd(where as any);
    // 资源存在，恢复
    model.isDeleted = "no";
    Object.assign(model, attr);
    return model.save();
  };

  const TRASH_OPT = Object.freeze({ fields: ["isDeleted", "deletorId"] });
  const remove = async (model: Sequelize.Model, deletorId: UserId) => {
    // 未开启回收站，直接删除
    if (!(model as any).isDeleted) return model.destroy();
    // 这里不做字段是否存在的判断，无所谓
    (model as any).deletorId = deletorId;
    (model as any).isDeleted = "yes";
    // 丢进垃圾桶
    return model.save(TRASH_OPT);
  };

  // count条件所需属性
  const COUNT_OPT = Object.freeze(["where", "include"]);
  const list = async (Model: TModel, params: Params, allowAttrs?: string[], toJSON?: boolean) => {
    const opt = findAllOpts(Model, params);
    const { _ignoreTotal } = params;

    // 提高查询速度
    let count = 0;
    if (_ignoreTotal !== "yes") count = await (Model as any).count(_.pick(opt, COUNT_OPT));

    if (Array.isArray(allowAttrs) && allowAttrs.length) opt.attributes = allowAttrs;
    const rows = await (Model as any).findAll(opt);
    if (toJSON) {
      for (let i = 0; i < rows.length; i += 1) {
        rows[i] = rows[i].toJSON();
      }
    }
    return { count, rows };
  };

  return { modify, add, remove, list, stats: Stats(cnf, deps, utils) };
}

export const Deps = ["errors"];
