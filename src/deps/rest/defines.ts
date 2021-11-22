import * as Sequelize from "sequelize";

export interface Params {
  [propName: string]: any;
}

export type TModel = typeof Sequelize.Model & {
  filterAttrs?: string[];
  writableCols?: string[];
  editableCols?: string[];
  allowIncludeCols?: string[];
  onlyAdminCols?: string[];
  pagination?: {
    maxResults: number;
    maxStartIndex: number;
    maxResultsLimit: number;
  };
  sort?: {
    default: string;
    allow: string[];
    defaultDirection?: "DESC" | "ASC";
  };
  includes?: {
    [k: string]: {
      as: string;
      required: boolean;
      model: TModel;
    };
  };
  searchCols?: {
    [k: string]: {
      op: "=" | "LIKE";
      match: string[];
    };
  };
  stats?: {
    dimensions?: Record<string, string>;
    metrics: Record<string, string>;
    pagination?: {
      maxResults: number;
      maxStartIndex: number;
      maxResultsLimit: number;
    };
  };
  unique?: string[];
};

export type ModelExtraAtts = Omit<TModel, keyof typeof Sequelize.Model>;

export interface Include {
  as: string;
  required: boolean;
  model: TModel;
}
