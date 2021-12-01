import * as Sequelize from "sequelize";
import * as moment from "moment";

interface Cnf {
  sequelize: {
    [propName: string]: Sequelize.Options;
  };
}

interface Deps {
  Sequelize: {
    Sequelize: typeof Sequelize.Sequelize;
  };
}

export function Main(cnf: Cnf, deps: Deps) {
  // 这里之所以要注入 Sequelize 是为了保证项目自身可以灵活选择自己的 Sequelize 版本, 这样改公共模块就会更加稳定, 避免频繁升级
  const { sequelize: dbs } = cnf;
  const { Sequelize } = deps;
  const sequelizes: { [propName: string]: Sequelize.Sequelize } = {};
  for (const k of Object.keys(dbs)) {
    const db = dbs[k];
    sequelizes[k] = new Sequelize.Sequelize(db);
  }

  return sequelizes;
}

export const Deps = ["Sequelize"];
