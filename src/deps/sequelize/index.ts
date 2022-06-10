import { Model, Options, Sequelize } from "sequelize";

interface Cnf {
  sequelize: {
    [propName: string]: Options;
  };
}

interface Deps {
  Sequelize: {
    Sequelize: typeof Sequelize;
  };
}

type NonConstructorKeys<T> = { [P in keyof T]: T[P] extends new () => any ? never : P }[keyof T];
type NonConstructor<T> = Pick<T, NonConstructorKeys<T>>;

export type ModelStatic<M extends ModelBase> = NonConstructor<typeof ModelBase> & (new () => M);

export function Main(cnf: Cnf, deps: Deps) {
  // 这里之所以要注入 Sequelize 是为了保证项目自身可以灵活选择自己的 Sequelize 版本, 这样改公共模块就会更加稳定, 避免频繁升级
  const { sequelize: dbs } = cnf;
  const { Sequelize } = deps;
  const sequelizes: { [propName: string]: Sequelize } = {};
  for (const k of Object.keys(dbs)) {
    const db = dbs[k];
    sequelizes[k] = new Sequelize.Sequelize(db);
  }

  return sequelizes;
}

export const Deps = ["Sequelize"];

/** Model 上的 sort 设定类型 */
export interface ModelSort<Fields extends string> {
  default: Fields;
  allow: Fields[];
  defaultDirection?: "DESC" | "ASC";
}

/** Model 上的 stats 设定类型 */
export interface ModelStats<Fields extends string> {
  dimensions?: Record<string, Fields>;
  metrics: Record<string, string>;
  pagination?: {
    maxResults: number;
    maxStartIndex: number;
    maxResultsLimit: number;
  };
}

/**
 * Model 基类
 */
export class ModelBase<Attrs extends {} = any, Attrs4Create extends {} = Attrs> extends Model<
  Attrs,
  Attrs4Create
> {
  /**
   * 基于主键获取某条数据的Mode实例，自动维护内存级 cache
   * @param pk 主键
   */
  public static getByPk<M extends ModelBase>(
    this: ModelStatic<M>,
    pk: string | number,
  ): Promise<M | null> {
    return this.findByPk(pk);
  }

  /**
   * 基于主键获取某些数据的Mode实例列表，维持参数的顺序，自动维护内存级 cache
   * @param pks 主键数组
   */
  public static async getByPks<M extends ModelBase>(
    this: ModelStatic<M>,
    pks: string[] | number[],
  ): Promise<M[]> {
    if (!Array.isArray(pks) || !pks.length) return [];
    //静态方法调用同一个类中的其他静态方法，可使用 this 关键字
    // eslint-disable-next-line no-undef
    const list = [];
    for await (const x of pks) {
      const item = await this.getByPk(x);
      if (item) list.push(item);
    }

    return list;
  }

  /** 允许过滤的字段, 对于某些隐私、敏感信息，应该禁止基于其过滤, 使用者反复尝试可以暴力破解敏感信息 */
  static filterAttrs?: string[];

  /** 新增资源的时候可以写入的列名称集合 */
  static writableCols?: string[] = [];

  /** 编辑资源的时候可以写入的列名称集合 */
  static editableCols?: string[] = [];

  /** 关联资源的时候允许被关联展示的列名称集合 */
  static allowIncludeCols?: string[];

  /** 编辑过程中，仅管理可以更改的列名称集合 */
  static onlyAdminCols?: string[];

  /** 列表查询时候分页控制参数 */
  static pagination?: {
    maxResults: number;
    maxStartIndex: number;
    maxResultsLimit: number;
  } = {
    maxResults: 10,
    maxStartIndex: 50000,
    maxResultsLimit: 5000,
  };

  /** 列表查询时候排序控制参数 */
  static sort?: ModelSort<string> = {
    default: "id",
    defaultDirection: "DESC",
    allow: ["id"],
  };

  /** 关联资源设定, 除非要关联过滤，否则不要设置资源之间的关联关系 */
  static includes?: {
    [k: string]: {
      as: string;
      required: boolean;
      model: typeof ModelBase;
    };
  };

  /** 模糊搜索相关设定 */
  static searchCols?: {
    [k: string]: {
      op: "=" | "LIKE";
      match: string[];
    };
  };

  /** 统计相关设定 */
  static stats?: {
    dimensions?: Record<string, string>;
    metrics: Record<string, string>;
    pagination?: {
      maxResults: number;
      maxStartIndex: number;
      maxResultsLimit: number;
    };
  };

  /** 联合唯一列名称集合，用来自动恢复软删除的资源 */
  static unique?: string[];

  /** cache 是否开启 */
  static cache = true;
}
