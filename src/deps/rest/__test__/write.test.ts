import _ from "lodash";
import * as Sequelize from "sequelize";
import { Main as Rest } from "..";

const utils = {
  pickParams: jest.fn(),
};

const errors = {
  notAllowed() {
    return new Error("重复添加资源");
  },
  resourceDuplicateAdd() {
    return new Error("重复");
  },
};

describe("rest.write", () => {
  const deps = {
    errors,
    _,
    mysql: {
      escape: jest.fn(),
    },
    dayjs: jest.fn(),
    Sequelize,
  };
  const helper = Rest({ rest: {} }, deps, utils as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe("modify", () => {
    it("case1", async () => {
      const Model = {
        writableCols: ["name", "age"],
        editableCols: ["name", "role", "age"],
      };
      const model = {
        id: 234,
        save: jest.fn(),
        changed: jest.fn(),
      };
      const params = {};
      model.save.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      expect(await helper.modify(Model as any, model as any, params)).toBe(model);
      expect((model as any).name).toBe("Redstone Zhao");
      expect((model as any).age).toBe(25);

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([
        params,
        ["name", "role", "age"],
        Model,
        false,
      ]);
    });

    it("case2, id cannot modify", async () => {
      const Model = {};
      const model = {
        id: 234,
        save: jest.fn(),
        changed: jest.fn(),
      };
      const params = {};
      const isAdmin = false;
      const _cols = undefined;
      model.save.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({
        id: 2345,
        name: "Redstone Zhao",
        age: 25,
      });
      expect(await helper.modify(Model as any, model as any, params, isAdmin, _cols)).toBe(model);
      expect((model as any).name).toBe("Redstone Zhao");
      expect((model as any).age).toBe(25);

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([params, [], Model, false]);
    });
  });

  describe("add", () => {
    it("case1", async () => {
      const Model = {
        writableCols: ["name", "age"],
        rawAttributes: {},
        create: jest.fn(),
      };
      const model = {
        id: 234,
        name: "Redstone Zhao",
        age: 25,
      };
      const creatorId = "creatorId";
      const clientIp = "clientIp";
      const params = {};
      const isAdmin = false;
      const _cols = undefined;
      Model.create.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      expect(
        await helper.add(Model as any, params, isAdmin, _cols, { creatorId, clientIp }),
      ).toEqual(model);

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([params, ["name", "age"], Model, false]);

      expect(Model.create.mock.calls.length).toBe(1);
      expect(Model.create.mock.calls.pop()).toEqual([{ name: "Redstone Zhao", age: 25 }]);
    });

    it("case2", async () => {
      const Model = {
        writableCols: ["name", "age"],
        rawAttributes: { creatorId: {}, clientIp: {} },
        create: jest.fn(),
      };
      const model = {
        id: 234,
        name: "Redstone Zhao",
        age: 25,
      };
      const creatorId = "creatorId";
      const clientIp = "clientIp";
      const params = {};
      const isAdmin = undefined;
      const _cols = undefined;
      Model.create.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      expect(
        await helper.add(Model as any, params, isAdmin, _cols, { creatorId, clientIp }),
      ).toEqual(model);

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([params, ["name", "age"], Model, false]);

      expect(Model.create.mock.calls.length).toBe(1);
      expect(Model.create.mock.calls.pop()).toEqual([
        {
          creatorId: "creatorId",
          clientIp: "clientIp",
          name: "Redstone Zhao",
          age: 25,
        },
      ]);
    });

    it("case3, 开启了回收站，但对应资源不存在", async () => {
      const Model = {
        writableCols: ["name", "age"],
        rawAttributes: { creatorId: {}, clientIp: {}, isDeleted: {} },
        unique: ["name"],
        findOne: jest.fn(),
        create: jest.fn(),
      };
      const model = {
        id: 234,
        name: "Redstone Zhao",
        age: 25,
      };
      const creatorId = "creatorId";
      const clientIp = "clientIp";
      const params = {};
      const isAdmin = false;
      const _cols = undefined;
      Model.create.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      expect(
        await helper.add(Model as any, params, isAdmin, _cols, { creatorId, clientIp }),
      ).toEqual(model);

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([params, ["name", "age"], Model, false]);

      expect(Model.create.mock.calls.length).toBe(1);
      expect(Model.create.mock.calls.pop()).toEqual([
        {
          creatorId: "creatorId",
          clientIp: "clientIp",
          name: "Redstone Zhao",
          age: 25,
        },
      ]);

      expect(Model.findOne.mock.calls.length).toBe(1);
      expect(Model.findOne.mock.calls.pop()).toEqual([
        {
          where: { name: "Redstone Zhao" },
        },
      ]);
    });

    it("case4, 开启了回收站，对应资源存在", async () => {
      const Model = {
        writableCols: ["name", "age"],
        rawAttributes: { creatorId: {}, clientIp: {}, isDeleted: {} },
        unique: ["name"],
        findOne: jest.fn(),
        create: jest.fn(),
      };
      const model = {
        id: 234,
        name: "Redstone Zhao",
        age: 26,
        isDeleted: "yes",
        save: jest.fn(),
      };
      const creatorId = "creatorId";
      const clientIp = "clientIp";
      const params = {};
      const isAdmin = false;
      const _cols = undefined;
      model.save.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      Model.findOne.mockResolvedValueOnce(model);
      expect(
        await helper.add(Model as any, params, isAdmin, _cols, { creatorId, clientIp }),
      ).toEqual(model);

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([params, ["name", "age"], Model, false]);

      expect(model.save.mock.calls.length).toBe(1);
      expect(model.save.mock.calls.pop()).toEqual([]);

      expect(Model.findOne.mock.calls.length).toBe(1);
      expect(Model.findOne.mock.calls.pop()).toEqual([
        {
          where: { name: "Redstone Zhao" },
        },
      ]);
    });

    it("case5, 开启了回收站，对应资源存在", async () => {
      const Model = {
        writableCols: ["name", "age"],
        rawAttributes: { creatorId: {}, clientIp: {}, isDeleted: {} },
        unique: ["name"],
        findOne: jest.fn(),
        create: jest.fn(),
      };
      const model = {
        id: 234,
        name: "Redstone Zhao",
        age: 25,
        isDeleted: "no",
      };
      const creatorId = "creatorId";
      const clientIp = "clientIp";
      const params = {};
      const isAdmin = false;
      const _cols = undefined;
      Model.findOne.mockReturnValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      await expect(
        helper.add(Model as any, params, isAdmin, _cols, { creatorId, clientIp }),
      ).rejects.toThrow("重复");

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([params, ["name", "age"], Model, false]);

      expect(Model.create.mock.calls.length).toBe(0);

      expect(Model.findOne.mock.calls.length).toBe(1);
      expect(Model.findOne.mock.calls.pop()).toEqual([
        {
          where: { name: "Redstone Zhao" },
        },
      ]);
    });

    it("case6", async () => {
      const Model = {
        rawAttributes: { creatorId: {}, clientIp: {} },
        create: jest.fn(),
      };
      const model = {
        id: 234,
        name: "Redstone Zhao",
        age: 25,
      };
      const creatorId = "creatorId";
      const clientIp = "clientIp";
      const params = {};
      const isAdmin = undefined;
      const _cols = undefined;
      Model.create.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({});
      expect(
        await helper.add(Model as any, params, isAdmin, _cols, { creatorId, clientIp }),
      ).toEqual(model);

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([params, [], Model, false]);

      expect(Model.create.mock.calls.length).toBe(1);
      expect(Model.create.mock.calls.pop()).toEqual([
        {
          creatorId: "creatorId",
          clientIp: "clientIp",
        },
      ]);
    });
  });

  describe("remove", () => {
    it("case1", async () => {
      const model = {
        destroy: jest.fn(),
      };

      model.destroy.mockResolvedValueOnce(model);
      expect(await helper.remove(model as any, "creatorId")).toEqual(model);
    });

    it("case2", async () => {
      const model = {
        save: jest.fn(),
        isDeleted: "no",
      };

      model.save.mockResolvedValueOnce(model);
      expect(await helper.remove(model as any, "creatorId")).toMatchObject({
        isDeleted: "yes",
        deletorId: "creatorId",
      });
    });
  });
});
