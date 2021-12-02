import * as Sequelize from "sequelize";
import { Main } from "..";

describe("Sequelize", () => {
  it("case1", async () => {
    const db1 = {
      host: "127.0.0.1",
      port: 3306,
      database: "redstone",
      username: "root",
      password: "DB_PASS",
      dialect: "mysql",
      dialectOptions: {
        /** 支持大数的计算 */
        supportBigNumbers: true,
        charset: "utf8mb4",
      },
      logging(str: string, opt: any) {
        console.log(str);
        if (opt && opt.bind) console.log(opt.bind);
      },
      define: {
        underscored: false,
        freezeTableName: true,
        charset: "utf8mb4",
        collate: "utf8mb4_general_ci",
        engine: "InnoDB",
      },
      pool: {
        min: 2,
        max: 10,
        /** 单位毫秒 */
        idle: 300 * 1000,
      },
    } as const;
    const cnf = {
      sequelize: {
        db1,
      },
    };

    const SequelizeMock = jest.fn();
    const deps = {
      Sequelize: {
        Sequelize: SequelizeMock as unknown as typeof Sequelize.Sequelize,
      },
    };

    const sequelize = {
      query: jest.fn(),
    };
    SequelizeMock.mockImplementationOnce(() => sequelize);

    const dbs = Main(cnf, deps);
    expect(SequelizeMock).toHaveBeenCalledTimes(1);
    expect(dbs.db1).toBe(sequelize);
    sequelize.query.mockResolvedValueOnce([true, 2]);
    const res = await dbs.db1.query("SELECT 1 + 1 as `Sum`");
    expect(res).toEqual([true, 2]);
  });
});
