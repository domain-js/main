import * as util from "util";

export default () => {
  const defines = [
    ["duplicatRegistMessage", "The message has been registed: %s"],
    ["registWhenReadyAfter", "The message dont registed when mcenter be ready after: %s"],
    [
      "submitUnregistedMessage",
      "The message has not been registed: %s, data: %o, when will submit",
    ],
    ["linkUnregistedMessage", "The message has not been registed: %s, when will link"],
    [
      "linkUnknowTypes",
      "The message link type unknown, message name is: %s, type is: %s, when will link",
    ],
    [
      "linkDuplicateType",
      "The message link type duplicate, message name is: %s, type is: %s, when will link",
    ],
    [
      "linkListernerMustBeFunctionType",
      "The message link waiter must be a function, message name is: %s, type is: %s, when will link",
    ],
    ["setFnNotAllowed", "Set function but unknown type: %s"],
  ];

  type Err = Error & { code?: string };
  type ErrFn = (...args: any[]) => Err;

  const fns: { [key: string]: ErrFn } = {};

  for (const [code, message] of defines) {
    fns[code] = (...args: any[]) => {
      const error: Err = Error(util.format(message, ...args));
      error.code = code;

      return error;
    };
  }

  return fns;
};
