function Main(cnf, deps, utils) {
  const { _ } = deps;

  const defaultPagination = {
    maxResults: 10,
    maxStartIndex: 10000,
    maxResultsLimit: 5000,
  };

  // 获取统计的条目数
  const statsCount = async (Model, opts, dims) => {
    if (!dims) return 1;
    if (!dims.length) return 1;
    const {
      sequelize: { Sequelize },
    } = Model;
    const option = { raw: true };
    if (opts.where) option.where = opts.where;
    if (opts.include) option.include = opts.include;
    const distincts = _.map(dims, (x) => x[0]);
    option.attributes = [Sequelize.literal(`COUNT(DISTINCT ${distincts.join(", ")}) AS count`)];
    const res = await Model.findOne(option);

    return (res && res.count) || 0 | 0;
  };

  const getDimensions = (Model, dimensions, _dims) => {
    const dims = [];

    if (!dimensions) return dims;

    // 如果 dimensions 未定义则直接退出
    if (!Array.isArray(dimensions)) throw Error("维度未定义");

    // 循环遍历维度设置
    _.each(dimensions, (dim) => {
      // Model 静态的配置
      const key = Model.stats.dimensions[dim] || (_dims && _dims[dim]);
      // 如果不在允许的范围内，则直接报错
      if (!key) throw Error("Dimensions dont allowed");
      dims.push([key, dim]);
    });

    return dims;
  };

  const group = (dims) => {
    if (!dims) return undefined;
    if (!_.isArray(dims)) return undefined;
    if (!dims.length) return undefined;
    return _.map(dims, (x) => x[1]);
  };

  const getMetrics = (Model, metrics, _mets) => {
    const mets = [];

    // 如果设置了，但是不为字符串，直接返回错误
    if (!Array.isArray(metrics)) throw Error("指标未定义");

    // 循环遍历所有的指标
    _.each(metrics, (met) => {
      // 处理静态的配置
      const key = Model.stats.metrics[met] || (_mets && _mets[met]);
      // 如果指标不在允许的范围内，则直接报错
      if (!key) throw Error("Metrics dont allowed");
      mets.push([key, met]);
    });

    return mets;
  };

  const getSort = (Model, params) => {
    const {
      sequelize: { Sequelize },
    } = Model;
    const sort = params._sort;
    let allowSort = [];

    if (!sort) return undefined;

    const isDesc = sort[0] === "-";

    const direction = isDesc ? "DESC" : "ASC";
    const order = isDesc ? sort.substring(1) : sort;

    _.each(["dimensions", "metrics"], (k) => {
      if (params[k] && _.isArray(params[k])) {
        allowSort = allowSort.concat(params[k]);
      }
    });

    if (!_.includes(allowSort, order)) return undefined;

    return [[Sequelize.literal(order), direction]];
  };

  const pageParams = (Model, params) => {
    const pagination = Model.stats.pagination || defaultPagination;
    return utils.pageParams(pagination, params);
  };

  const statistics = async (Model, params, where, conf) => {
    const { dimensions, metrics, _ignoreTotal } = params;
    const option = {};
    const dims = getDimensions(Model, dimensions, conf && conf.dimensions);
    const mets = getMetrics(Model, metrics, conf && conf.metrics);
    const limit = pageParams(Model, params);
    const listOpts = utils.findAllOpts(Model, params);
    const ands = [];

    if (listOpts.where) ands.push(listOpts.where);
    if (where) {
      if (_.isString(where)) {
        ands.push([where, [""]]);
      } else {
        ands.push(where);
      }
    }
    Object.assign(option, {
      attributes: [].concat(dims || [], mets),
      group: group(dims),
      order: getSort(Model, params),
      offset: limit.offset,
      limit: limit.limit,
      raw: true,
    });
    if (ands.length) {
      option.where = Model.sequelize.and(...ands);
    }

    if (listOpts.include) {
      option.include = _.map(listOpts.include, (x) => {
        x.attributes = [];
        return x;
      });
    }

    const opt = _.omitBy(option, _.isUndefined);
    opt.raw = true;
    let count = 0;
    if (_ignoreTotal !== "yes") count = await statsCount(Model, opt, dims);
    const rows = await Model.findAll(opt);
    for (const x of rows) {
      for (const met of metrics) {
        x[met] = x[met] ? Number(x[met]) : 0;
      }
    }
    return { count, rows };
  };

  return statistics;
}

module.exports = Main;
