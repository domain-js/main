import { Utils } from "./utils";

type Cnf = Parameters<typeof Utils>[0];
type Deps = Parameters<typeof Utils>[1];

export function Before(cnf: Cnf, deps: Deps): [Cnf, Deps, ReturnType<typeof Utils>] {
  const utils = Utils(cnf, deps);

  return [cnf, deps, utils];
}
