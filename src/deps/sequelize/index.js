function Main(cnf, deps) {
  // 这里之所以要注入 Sequelize 是为了保证项目自身可以灵活选择自己的 Sequelize 版本, 这样改公共模块就会更加稳定, 避免频繁升级
  const { Sequelize } = deps;
  const { sequelize: dbs } = cnf;
  const sequelizes = {};
  for (const k of Object.keys(dbs)) {
    const db = dbs[k];
    sequelizes[k] = new Sequelize(db.name, db.user, db.pass, db);
  }

  return sequelizes;
}

Main.Deps = ["Sequelize"];

module.exports = Main;
