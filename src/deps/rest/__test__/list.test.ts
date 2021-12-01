import * as _ from "lodash";
import * as Sequelize from "sequelize";
import { Main as Rest } from "..";

const errors = {
  notAllowed: jest.fn(),
  resourceDuplicateAdd: jest.fn(),
};

describe("helper.list", () => {
  const utils = {
    findAllOpts: jest.fn(),
  };

  const deps = {
    errors,
    _,
    mysql: {
      escape: jest.fn(),
    },
    moment: jest.fn(),
    Sequelize,
  };

  const { list } = Rest({ rest: {} }, deps, utils as any);
  it("case1", async () => {
    const Model = {
      count: jest.fn(),
      findAll: jest.fn(),
      rawAttributes: {},
    };
    Model.count.mockResolvedValueOnce(0);
    Model.findAll.mockResolvedValueOnce([]);
    utils.findAllOpts.mockReturnValueOnce({
      where: { userId: "12" },
      include: [{ model: {}, as: "user" }],
      order: [],
    });
    const params = {};
    expect(await list(Model as any, params)).toEqual({ rows: [], count: 0 });

    expect(Model.count.mock.calls.length).toBe(1);
    expect(Model.count.mock.calls.pop()).toEqual([
      {
        where: { userId: "12" },
        include: [{ model: {}, as: "user" }],
      },
    ]);

    expect(utils.findAllOpts.mock.calls.length).toBe(1);
    expect(utils.findAllOpts.mock.calls.pop()).toEqual([Model, params]);

    expect(Model.findAll.mock.calls.length).toBe(1);
    expect(Model.findAll.mock.calls.pop()).toEqual([
      {
        where: { userId: "12" },
        include: [{ model: {}, as: "user" }],
        order: [],
      },
    ]);
  });

  it("case2", async () => {
    const Model = {
      count: jest.fn(),
      findAll: jest.fn(),
      rawAttributes: {},
    };
    Model.count.mockResolvedValueOnce(0);
    Model.findAll.mockResolvedValueOnce([{ id: 1, name: "redstone" }]);
    utils.findAllOpts.mockReturnValueOnce({
      where: { userId: "12" },
      include: [{ model: {}, as: "user" }],
      order: [],
    });
    const params = {
      _ignoreTotal: "yes",
    };
    const allowAttrs = ["id", "name"];
    expect(await list(Model as any, params, allowAttrs)).toEqual({
      rows: [{ id: 1, name: "redstone" }],
      count: 0,
    });

    expect(Model.count.mock.calls.length).toBe(0);

    expect(utils.findAllOpts.mock.calls.length).toBe(1);
    expect(utils.findAllOpts.mock.calls.pop()).toEqual([Model, params]);

    expect(Model.findAll.mock.calls.length).toBe(1);
    expect(Model.findAll.mock.calls.pop()).toEqual([
      {
        attributes: ["id", "name"],
        where: { userId: "12" },
        include: [{ model: {}, as: "user" }],
        order: [],
      },
    ]);
  });

  it("case2, toJSON is true", async () => {
    const Model = {
      count: jest.fn(),
      findAll: jest.fn(),
      rawAttributes: {},
    };
    Model.count.mockResolvedValueOnce(0);
    Model.findAll.mockResolvedValueOnce([{ toJSON: () => ({ id: 1, name: "redstone" }) }]);
    utils.findAllOpts.mockReturnValueOnce({
      where: { userId: "12" },
      include: [{ model: {}, as: "user" }],
      order: [],
    });
    const params = {
      _ignoreTotal: "yes",
    };
    const allowAttrs = ["id", "name"];
    expect(await list(Model as any, params, allowAttrs, true)).toEqual({
      rows: [{ id: 1, name: "redstone" }],
      count: 0,
    });

    expect(Model.count.mock.calls.length).toBe(0);

    expect(utils.findAllOpts.mock.calls.length).toBe(1);
    expect(utils.findAllOpts.mock.calls.pop()).toEqual([Model, params]);

    expect(Model.findAll.mock.calls.length).toBe(1);
    expect(Model.findAll.mock.calls.pop()).toEqual([
      {
        attributes: ["id", "name"],
        where: { userId: "12" },
        include: [{ model: {}, as: "user" }],
        order: [],
      },
    ]);
  });
});
