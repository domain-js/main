import { Errors } from "./Errors/index";

const defines = [
  ["notFound", "Resource not found"],
  ["notAllowed", "No access"],
  ["noAuth", "Not authentication"],
] as const;

export const errors = Object.freeze(Errors(defines));
