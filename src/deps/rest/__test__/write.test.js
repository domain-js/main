const _ = require("lodash");
const Rest = require("..");

const utils = {
  pickParams: jest.fn(),
};

const errors = {
  resourceDuplicateAdd() {
    return Error("重复添加资源");
  },
};

describe("rest.write", () => {
  const helper = Rest({}, { _, errors }, utils);
  describe("modify", () => {
    it("case1", async () => {
      const Model = {
        writableCols: ["name", "age"],
        editableCols: ["name", "role", "age"],
      };
      const model = {
        id: 234,
        save: jest.fn(),
      };
      const params = {};
      const isAdmin = false;
      const _cols = null;
      model.save.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      expect(await helper.modify(Model, model, params, isAdmin, _cols)).toBe(model);
      expect(model.name).toBe("Redstone Zhao");
      expect(model.age).toBe(25);

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([
        params,
        ["name", "role", "age"],
        Model,
        false,
      ]);
    });

    it("case2, id cannot modify", async () => {
      const Model = {
        writableCols: ["name", "age"],
      };
      const model = {
        id: 234,
        save: jest.fn(),
      };
      const params = {};
      const isAdmin = false;
      const _cols = null;
      model.save.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({
        id: 2345,
        name: "Redstone Zhao",
        age: 25,
      });
      expect(await helper.modify(Model, model, params, isAdmin, _cols)).toBe(model);
      expect(model.name).toBe("Redstone Zhao");
      expect(model.age).toBe(25);

      expect(utils.pickParams.mock.calls.length).toBe(1);
      expect(utils.pickParams.mock.calls.pop()).toEqual([params, ["name", "age"], Model, false]);
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
      const _cols = null;
      Model.create.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      expect(await helper.add(Model, params, isAdmin, _cols, { creatorId, clientIp })).toEqual(
        model,
      );

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
      const isAdmin = false;
      const _cols = null;
      Model.create.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      expect(await helper.add(Model, params, isAdmin, _cols, { creatorId, clientIp })).toEqual(
        model,
      );

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
      const _cols = null;
      Model.create.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      expect(await helper.add(Model, params, isAdmin, _cols, { creatorId, clientIp })).toEqual(
        model,
      );

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
      const _cols = null;
      model.save.mockResolvedValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      Model.findOne.mockResolvedValueOnce(model);
      expect(await helper.add(Model, params, isAdmin, _cols, { creatorId, clientIp })).toEqual(
        model,
      );

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
      const _cols = null;
      Model.findOne.mockReturnValueOnce(model);
      utils.pickParams.mockReturnValueOnce({ name: "Redstone Zhao", age: 25 });
      await expect(
        helper.add(Model, params, isAdmin, _cols, { creatorId, clientIp }),
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
  });

  describe("remove", () => {
    it("case1", async () => {
      const model = {
        destroy: jest.fn(),
      };

      model.destroy.mockResolvedValueOnce(model);
      expect(await helper.remove(model, "creatorId")).toEqual(model);
    });

    it("case2", async () => {
      const model = {
        save: jest.fn(),
        isDeleted: "no",
      };

      model.save.mockResolvedValueOnce(model);
      expect(await helper.remove(model, "creatorId")).toMatchObject({
        isDeleted: "yes",
        deletorId: "creatorId",
      });
    });
  });
});
