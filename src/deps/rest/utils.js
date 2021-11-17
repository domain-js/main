function Utils(cnf, deps) {
  const {
    rest: { relativeMaxRangeDays: RELATIVE_MAX_RANGE = 100 },
  } = cnf;

  const { mysql, errors, _, moment, Sequelize } = deps;

  /**
   * 相对多少天的时间
   * @param Number days 相对多少天
   * @params Boolean [isStart] 是否是开始, 默认true， false 返回结束时间
   *
   * @return Date
   */
  const relativeDays = (days, isStart = true) => {
    const now = Date.now();
    const ms = now + days * 86400000;

    const offset = (isStart ? 0 : 86400000) - (now % 86400000);

    return new Date(ms + offset);
  };

  const NUMBER_TYPES = new Set(["INTEGER", "FLOAT"]);
  const pickParams = (params, cols, Model, isAdmin) => {
    const attr = {};
    const { rawAttributes, onlyAdminCols } = Model;

    _.each(cols, (x) => {
      if (!_.has(params, x)) return;
      if (!_.has(rawAttributes, x)) return;
      const C = rawAttributes[x];

      // 当设置了只有管理员才可以修改的字段，并且当前用户不是管理员
      // 则去掉那些只有管理员才能修改的字段
      if (onlyAdminCols && !isAdmin && _.includes(onlyAdminCols, x)) return;

      let value = params[x];

      // 如果是数字类型的则数字化
      if (NUMBER_TYPES.has(C.type.key) && value != null) value = +value;

      // 如果字段允许为空，且默认值为 null 则在等于空字符串的时候赋值为 null
      if ((value === "" || value === null || value === undefined) && _.has(C, "defaultValue")) {
        value = C.allowNull === true ? null : C.defaultValue;
      }

      attr[x] = value;
    });

    return attr;
  };

  // 处理排序参数
  const sort = (params, conf, includes) => {
    const value = params._sort;
    if (!conf) return undefined;
    if (!(value || conf.default)) return undefined;

    if (!value) return [[conf.default, conf.defaultDirection || "ASC"]];

    const orders = value.split(",").map((x) => {
      const isDesc = x[0] === "-";

      const direction = isDesc ? "DESC" : "ASC";
      const order = isDesc ? x.slice(1) : x;

      // 如果请求的排序方式不允许，则返回null
      if (!conf.allow || !_.includes(conf.allow, order)) return undefined;

      const theOrder = order.split(".");
      // 处理使用模型名称作为关联名称按关联模型的 字段 排序
      if (theOrder.length === 2) {
        if (includes && Array.isArray(params._includes)) {
          const ret = _.filter(params._includes, (val) => includes[val]);
          if (!ret.includes(theOrder[0])) {
            return undefined;
          }
        } else {
          return undefined;
        }
      }

      theOrder.push(direction);
      return theOrder;
    });
    return _.compact(orders);
  };

  // searchOpt 的处理，处理参数参数里的q, 实现简易搜索功能
  /**
#
[ # 这下面有三个子数组，代表该model有三个字段参与搜索
  [ # 这个数组长度为2，代表此次有2个搜索关键词
    # 这个字符串用 OR 切开有三部分，代表该字段定义的search.match 有三部分
    '((`user`.`name` LIKE \'a\')
      OR (`user`.`name` LIKE \'%,a\')
      OR (`user`.`name` LIKE \'a,%\')
      OR (`user`.`name` LIKE \'%,a,%\'))'
    '((`user`.`name` LIKE \'b\')
      OR (`user`.`name` LIKE \'%,b\')
      OR (`user`.`name` LIKE \'b,%\')
      OR (`user`.`name` LIKE \'%,b,%\'))'
  ]
  [
    '((`user`.`email` LIKE \'%a%\'))'
    '((`user`.`email` LIKE \'%b%\'))'
  ]
  [
    '((`user`.`id` = \'a\'))'
    '((`user`.`id` = \'b\'))'
  ]
]
*/
  const searchOpt = (Model, searchStr, qstr, as) => {
    if (!qstr) return undefined;
    if (!_.isString(qstr)) return undefined;
    const q = qstr.trim() ? _.split(qstr.trim(), " ", 5) : null;
    if (!q) return undefined;
    const searchs = searchStr ? _.split(searchStr, ",") : null;
    const ors = [];
    if (!Model.searchCols) return undefined;
    _.each(Model.searchCols, (conf, col) => {
      // 如果设置了搜索的字段，并且当前字读不在设置的搜索字段内，则直接返回
      // 相当于跳过这个设置
      const _col = as ? `${as}.${col}` : col;
      // 如果是include里的search，必须指定searchs
      // 这么做是为了避免用户不知情的一些筛选过滤
      if (!searchs && as) return;
      if (searchs && searchs.length && !_.includes(searchs, _col)) return;
      ors.push(
        _.map(q, (x) => {
          const arr = _.map(conf.match, (match) => {
            const v = match.replace("{1}", x);
            return [`(\`${as || Model.name}\`.\`${col}\``, conf.op, `${mysql.escape(v)})`].join(
              " ",
            );
          });
          return `(${arr.join(" OR ")})`;
        }),
      );
    });
    return ors;
  };

  // 合并多个词语的搜索条件
  // 将单个或多个 searchOpt 返回的数组正确的合并成 where 子句, 字符串类型的
  // 这个函数的目的是为了正确的使每个关键词之间的关系是 AND 的关系
  // 单个关键词在不同的搜索字段之间是 OR 的关系
  const mergeSearchOrs = (orss) => {
    const ands = [];
    _.each(orss, (_orss) => {
      _.each(_orss, (ors) => {
        _.each(ors, (_or, index) => {
          if (!ands[index]) ands[index] = [];
          ands[index].push(_or);
        });
      });
    });
    const andsStr = _.map(ands, (x) => `(${x.join(" OR ")})`);
    return `(${andsStr.join(" AND ")})`;
  };

  // 处理关联包含
  // 返回
  // [Model1, Model2]
  // 或者 undefined
  const modelInclude = (params, includes) => {
    if (!includes) return undefined;
    if (!Array.isArray(params._includes)) return undefined;
    const ret = _.filter(params._includes, (x) => includes[x]);
    if (ret.length === 0) return undefined;
    // 这里之所以要用 _.clone 是为了防止修改了原始了配置信息，从而导致不同请求之间的干扰
    return _.map(ret, (x) => _.clone(includes[x]));
  };

  const DEFAULT_PAGE_PARAMS = Object.freeze({
    maxResults: 10,
    maxStartIndex: 100000,
    maxResultsLimit: 100000,
  });

  const pageParams = (pagination, params) => {
    const _pagination = { ...DEFAULT_PAGE_PARAMS, ...pagination };
    const startIndex = Math.max(params._startIndex | 0, 0);
    const maxResults = Math.max(params._maxResults | 0 || _pagination.maxResults, 1);
    return {
      offset: Math.min(startIndex, _pagination.maxStartIndex),
      limit: Math.min(maxResults, _pagination.maxResultsLimit),
    };
  };

  const RELATIVE_RANGE_ERROR = errors.notAllowed(`相对时间跨度最多 ${RELATIVE_MAX_RANGE} 天`);
  // findOptFilter 的处理
  const findOptFilter = (params, name, where, Op, col = name) => {
    let value;
    if (!params) return;
    if (!_.isObject(params)) return;

    // 处理相对时间过滤
    if (_.isString(params[`${name}_relative`])) {
      let [start, end, ignoreYear] = params[`${name}_relative`].split(",");
      start |= 0;
      end |= 0;
      ignoreYear = ignoreYear === "yes";
      if (RELATIVE_MAX_RANGE < end - start) throw RELATIVE_RANGE_ERROR;
      if (!where[col]) where[col] = {};
      if (!where[col][Op.and]) where[col][Op.and] = [];
      if (ignoreYear) {
        // 忽略年，这里要处理跨年的问题
        const startDate = moment(Date.now() + start * 86400000).format("MM-DD");
        const endDate = moment(Date.now() + end * 86400000).format("MM-DD");
        if (endDate < startDate) {
          where[col][Op.and].push({
            [Op.or]: [
              Sequelize.where(
                Sequelize.fn("DATE_FORMAT", Sequelize.col(name), "%m-%d"),
                Op.between,
                Sequelize.literal(`'${startDate}' AND '12-31'`),
              ),
              Sequelize.where(
                Sequelize.fn("DATE_FORMAT", Sequelize.col(name), "%m-%d"),
                Op.between,
                Sequelize.literal(`'01-01' AND '${endDate}'`),
              ),
            ],
          });
        } else {
          where[col][Op.and].push(
            Sequelize.where(
              Sequelize.fn("DATE_FORMAT", Sequelize.col(name), "%m-%d"),
              Op.between,
              Sequelize.literal(`'${startDate}' AND '${endDate}'`),
            ),
          );
        }
      } else {
        where[col][Op.and].push(
          Sequelize.where(Sequelize.fn("DATE", Sequelize.col(name)), {
            [Op.between]: [relativeDays(start), relativeDays(end, false)],
          }),
        );
      }
    }

    // 处理 where 的等于
    if (_.isString(params[name])) {
      value = params[name].trim();
      // 特殊处理null值
      if (value === ".null.") value = null;
      if (!where[col]) where[col] = {};
      where[col][Op.eq] = value;
    }
    if (_.isNumber(params[name])) {
      if (!where[col]) where[col] = {};
      where[col][Op.eq] = params[name];
    }

    // 处理where in
    if (_.isString(params[`${name}s`])) {
      if (!where[col]) where[col] = {};
      where[col][Op.in] = params[`${name}s`].trim().split(",");
    }
    // in 直接是数组的格式
    if (_.isArray(params[`${name}s`])) {
      if (!where[col]) where[col] = {};
      where[col][Op.in] = params[`${name}s`];
    }

    // 处理where not in
    if (_.isString(params[`${name}s!`])) {
      if (!where[col]) where[col] = {};
      where[col][Op.notIn] = params[`${name}s!`].trim().split(",");
    }
    // not in 直接是数组的格式
    if (_.isArray(params[`${name}s!`])) {
      if (!where[col]) where[col] = {};
      where[col][Op.notIn] = params[`${name}s!`];
    }

    // 处理不等于的判断
    if (_.isString(params[`${name}!`])) {
      value = params[`${name}!`].trim();
      if (!where[col]) where[col] = {};
      // 特殊处理null值
      if (value === ".null.") {
        value = null;
        where[col][Op.not] = value;
      } else {
        where[col][Op.ne] = value;
      }
    }

    // 处理like
    if (_.isString(params[`${name}_like`])) {
      value = params[`${name}_like`].trim().replace(/\*/g, "%");
      if (!where[col]) where[col] = {};
      where[col][Op.like] = value;
    }

    // 处理likes [like or]
    if (_.isString(params[`${name}_likes`])) {
      const likes = params[`${name}_likes`].trim().split(",");
      if (!where[col]) where[col] = {};
      where[col][Op.or] = likes.map((x) => {
        value = x.trim().replace(/\*/g, "%");
        return { [Op.like]: value };
      });
    }

    // 处理notLike
    if (_.isString(params[`${name}_notLike`])) {
      value = params[`${name}_notLike`].trim().replace(/\*/g, "%");
      if (!where[col]) where[col] = {};
      where[col][Op.notLike] = value;
    }

    // 处理大于，小于, 大于等于，小于等于的判断
    _.each(["gt", "gte", "lt", "lte"], (x) => {
      const c = `${name}_${x}`;
      if (!_.isString(params[c]) && !_.isNumber(params[c])) return;
      value = _.isString(params[c]) ? params[c].trim() : params[c];
      if (!where[col]) where[col] = {};
      where[col][Op[x]] = value;
    });

    // 处理 find_in_set 方式的过滤
    if (_.isString(params[`${name}_ins`]) || _.isNumber(params[`${name}_ins`])) {
      if (!where[Op.and]) where[Op.and] = [];
      where[Op.and].push(
        Sequelize.where(
          Sequelize.fn("FIND_IN_SET", params[`${name}_ins`], Sequelize.col(name)),
          Op.gte,
          1,
        ),
      );
    }

    // 处理 find_in_set 方式的过滤 _ins_and
    if (_.isString(params[`${name}_ins_and`])) {
      if (!where[Op.and]) where[Op.and] = [];
      for (const v of params[`${name}_ins_and`].split(",")) {
        where[Op.and].push(
          Sequelize.where(Sequelize.fn("FIND_IN_SET", v.trim(), Sequelize.col(name)), Op.gte, 1),
        );
      }
    }

    // 处理 find_in_set 方式的过滤 _ins_or
    if (_.isString(params[`${name}_ins_or`])) {
      if (!where[Op.and]) where[Op.and] = [];
      where[Op.and].push({
        [Op.or]: params[`${name}_ins_or`]
          .split(",")
          .map((v) =>
            Sequelize.where(Sequelize.fn("FIND_IN_SET", v.trim(), Sequelize.col(name)), Op.gte, 1),
          ),
      });
    }

    // 处理 find_in_set 方式的过滤 _ins_not
    if (_.isString(params[`${name}_ins_not`])) {
      if (!where[Op.and]) where[Op.and] = [];
      for (const v of params[`${name}_ins_not`].split(",")) {
        where[Op.and].push(
          Sequelize.where(Sequelize.fn("FIND_IN_SET", v.trim(), Sequelize.col(name)), Op.lt, 1),
        );
      }
    }
  };

  // 返回列表查询的条件
  const findAllOpts = (Model, params) => {
    const {
      sequelize: {
        Sequelize: { Op },
      },
    } = Model;
    const where = {};
    const searchOrs = [];
    const includes = modelInclude(params, Model.includes);
    _.each(Model.filterAttrs || _.keys(Model.rawAttributes), (name) => {
      findOptFilter(params, name, where, Op);
    });
    if (Model.rawAttributes.isDeleted && !params._showDeleted) {
      where.isDeleted = "no";
    }

    // 将搜索条件添加到主条件上
    searchOrs.push(searchOpt(Model, params._searchs, params.q));

    // 处理关联资源的过滤条件
    // 以及关联资源允许返回的字段
    if (includes) {
      _.each(includes, (x) => {
        const includeWhere = {};
        const filterAttrs = x.model.filterAttrs || _.keys(x.model.rawAttributes);
        _.each(filterAttrs, (name) => {
          findOptFilter(params, `${x.as}.${name}`, includeWhere, Op, name);
        });
        if (x.model.rawAttributes.isDeleted && !params._showDeleted) {
          includeWhere[Op.or] = [{ isDeleted: "no" }];
          if (x.required === false) includeWhere[Op.or].push({ id: null });
        }

        // 将搜索条件添加到 include 的 where 条件上
        searchOrs.push(searchOpt(x.model, params._searchs, params.q, x.as));

        x.where = includeWhere;

        // 以及关联资源允许返回的字段
        if (x.model.allowIncludeCols) x.attributes = x.model.allowIncludeCols;
      });
    }

    const ret = {
      include: includes,
      order: sort(params, Model.sort, Model.includes),
    };
    // 将 searchOrs 赋到 where 上
    const _searchOrs = _.filter(_.compact(searchOrs), (x) => x.length);

    if (_.size(where)) {
      if (_searchOrs.length) {
        ret.where = Sequelize.and(where, Sequelize.literal(mergeSearchOrs(_searchOrs)));
      } else {
        ret.where = where;
      }
    } else if (_searchOrs.length) {
      ret.where = Sequelize.literal(mergeSearchOrs(_searchOrs));
    }

    // 处理需要返回的字段
    (() => {
      const { _attrs } = params;
      if (!_attrs) return;
      if (!Array.isArray(_attrs) || !_attrs.length) return;
      ret.attributes = _attrs.filter((x) => Model.rawAttributes[x]);
    })();

    Object.assign(ret, pageParams(Model.pagination, params));

    return ret;
  };

  return Object.freeze({
    pickParams,
    findAllOpts,
    pageParams,
  });
}

module.exports = Utils;
