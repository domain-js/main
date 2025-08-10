import _ from "lodash";
import * as Sequelize from "sequelize";

import { ModelBase, ModelStatic } from "../sequelize";
import { Stats } from "./stats";
import { Utils } from "./utils";

export { Before } from "./Before";

type Cnf = Parameters<typeof Utils>[0] & Parameters<typeof Stats>[0];
type Deps = Parameters<typeof Utils>[1] &
  Parameters<typeof Stats>[1] & {
    _: typeof _;
    Sequelize: Pick<typeof Sequelize, "literal" | "and" | "fn" | "Op">;
    errors: any;
  };

type UserId = string | number;
export interface CreatorAndClientIp {
  /** ID of the resource creator */
  creatorId: UserId;
  /** IP of the resource creator */
  clientIp: string;
}

/**
 * Standard(CRUD) restful module, including list, add, edit, delete and statistics
 * @param cnf Configuration information of initialization function
 * @param deps Dependent object of the initialization function
 * @param utils Tool function object
 * @returns modify, add, remove, list, stats five methods
 */
export function Main(cnf: Cnf, deps: Deps, utils: ReturnType<typeof Utils>) {
  const { findAllOpts, pickParams } = utils;

  /**
   * Restful modify(U of CRUD) for update a resource
   * @param Model Model definition of resources
   * @param model the resources will be updated
   * @param params parameters for updating
   * @param isAdmin Is it an administrator
   * @param _cols Allow columns to be updated
   * @returns The resource that has been updated
   */
  const modify = async <T extends ModelBase>(
    Model: ModelStatic<T>,
    model: T,
    params: Record<string, any>,
    isAdmin = false,
    _cols?: string[],
  ): Promise<InstanceType<typeof Model>> => {
    const cols = _cols || Model.editableCols || Model.writableCols || [];
    const attr = pickParams(params, cols, Model, isAdmin);

    // 避免id 被篡改，强制删除id属性
    if (attr.id) delete attr.id;

    Object.assign(model, attr);

    const fields = model.changed();
    if (!Array.isArray(fields) || !fields.length) return model;

    try {
      return await model.save();
    } catch (e) {
      Object.assign(model, model.previous());
      throw e;
    }
  };

  /**
   * Restful add(C of CRUD) for create a resource
   * @param Model Model definition of resources
   * @param params parameters for updating
   * @param isAdmin Is it an administrator
   * @param _cols Allow columns to be set
   * @param creatorAndClientIp creatorId and clientIp
   * @returns The resource that has been created
   */
  const add = async <T extends ModelBase>(
    Model: ModelStatic<T>,
    params: Record<string, any>,
    isAdmin = false,
    _cols: string[] | undefined,
    { creatorId, clientIp }: CreatorAndClientIp,
  ): Promise<T> => {
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
    if (model.isDeleted === "no") throw deps.errors.resourceDuplicateAdd(where as any);
    // 资源存在，恢复
    model.isDeleted = "no";
    Object.assign(model, attr);
    return model.save();
  };

  const TRASH_OPT = Object.freeze({ fields: ["isDeleted", "deletorId", "deletedAt"] });
  /**
   * Restful remove (D of CRUD) for delete a resource
   * @param model the resources will be removed
   * @param deletorId Operator Id
   * @returns void OR Resources put in the recycle bin
   */
  const remove = async (model: Sequelize.Model, deletorId: UserId) => {
    // 未开启回收站，直接删除
    if (!(model as any).isDeleted) return model.destroy();
    // 这里不做字段是否存在的判断，无所谓
    (model as any).deletorId = deletorId;
    (model as any).isDeleted = "yes";
    (model as any).deletedAt = new Date();
    // 丢进垃圾桶
    return model.save(TRASH_OPT);
  };

  // count条件所需属性
  const COUNT_OPT = Object.freeze(["where", "include"]);
  /**
   * Restful list (R of CRUD) for list resource
   * @param Model Model definition of resources
   * @param params parameters for updating
   * @param allowAttrs Allow columns to be returned
   * @param toJSON Whether to directly return JSON formatted objects
   * @returns findAll resource result, object propoties has count, rows
   */
  async function list<T extends ModelBase, J = ReturnType<T["toJSON"]>>(
    Model: ModelStatic<T>,
    params: Record<string, any>,
    allowAttrs?: string[],
    toJSON?: false,
  ): Promise<{ rows: T[]; count: number }>;
  async function list<T extends ModelBase, J = ReturnType<T["toJSON"]>>(
    Model: ModelStatic<T>,
    params: Record<string, any>,
    allowAttrs?: string[],
    toJSON?: true,
  ): Promise<{ rows: J[]; count: number }>;
  async function list<T extends ModelBase, J = ReturnType<T["toJSON"]>>(
    Model: ModelStatic<T>,
    params: Record<string, any>,
    allowAttrs?: string[],
    toJSON?: false | true,
  ) {
    const opt = findAllOpts(Model, params);
    const { _ignoreTotal } = params;

    // 提高查询速度
    let count = 0;
    if (_ignoreTotal !== "yes") count = await (Model as any).count(_.pick(opt, COUNT_OPT));

    if (Array.isArray(allowAttrs) && allowAttrs.length) opt.attributes = allowAttrs;
    const rows = await Model.findAll(opt);
    if (!toJSON) return { rows, count };

    return { count, rows: rows.map((x) => x.toJSON() as J) };
  }

  return { modify, add, remove, list, stats: Stats(cnf, deps, utils) };
}

export const Deps = [];
