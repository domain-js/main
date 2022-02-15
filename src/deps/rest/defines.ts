import { ModelBase } from "../sequelize";

export interface Params {
  [propName: string]: any;
}

export type TModel = typeof ModelBase;
