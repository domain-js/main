const Before = require("./Before");
const Stats = require("./stats");

function Main(cnf, deps, utils) {
  const { _, errors } = deps;
  const { findAllOpts, pickParams } = utils;

  const modify = (Model, model, params, isAdmin, _cols) => {
    const cols = _cols || Model.editableCols || Model.writableCols;
    const attr = pickParams(params, cols, Model, isAdmin);

    // 避免id 被篡改，强制删除id属性
    if (attr.id) delete attr.id;

    Object.assign(model, attr);

    return model.save();
  };

  const add = async (Model, params, isAdmin, _cols, { creatorId, clientIp }) => {
    const cols = _cols || Model.writableCols;
    const attr = pickParams(params, cols, Model, isAdmin);

    if (Model.rawAttributes.creatorId) attr.creatorId = creatorId;
    if (Model.rawAttributes.clientIp) attr.clientIp = clientIp;

    // 如果没有设置唯一属性且开启回收站, 则直接添加
    if (!(Model.unique && Model.rawAttributes.isDeleted)) return Model.create(attr);

    // 如果设置了唯一属性，且开启了回收站功能
    // 则判断是否需要执行恢复操作
    const where = _.pick(attr, Model.unique);
    // 根据条件查找资源
    const model = await Model.findOne({ where });
    // 资源不存在
    if (!model) return Model.create(attr);

    // 资源存在但是并非已删除的，抛出资源重复添加的error
    if (model.isDeleted === "no") throw errors.resourceDuplicateAdd(where);
    // 资源存在，恢复
    model.isDeleted = "no";
    Object.assign(model, attr);
    return model.save();
  };

  const TRASH_OPT = { fields: ["isDeleted", "deletorId"] };
  const remove = async (model, deletorId) => {
    // 未开启回收站，直接删除
    if (!model.isDeleted) return model.destroy();
    // 这里不做字段是否存在的判断，无所谓
    model.deletorId = deletorId;
    model.isDeleted = "yes";
    // 丢进垃圾桶
    return model.save(TRASH_OPT);
  };

  // count条件所需属性
  const COUNT_OPT = Object.freeze(["where", "include"]);
  const list = async (Model, params, allowAttrs, toJSON) => {
    const opt = findAllOpts(Model, params);
    const { _ignoreTotal } = params;

    // 提高查询速度
    let count = 0;
    if (_ignoreTotal !== "yes") count = await Model.count(_.pick(opt, COUNT_OPT));

    if (Array.isArray(allowAttrs) && allowAttrs.length) opt.attributes = allowAttrs;
    const rows = await Model.findAll(opt);
    if (toJSON) {
      for (let i = 0; i < rows.length; i += 1) {
        rows[i] = rows[i].toJSON();
      }
    }
    return { count, rows };
  };

  return { modify, add, remove, list, stats: Stats(cnf, deps, utils) };
}

Main.Deps = ["errors", "_", "moment", "Sequelize"];
Main.Before = Before;

module.exports = Main;
