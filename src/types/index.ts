export type ReadonlyArray2union<T extends ReadonlyArray<any>> = T extends ReadonlyArray<infer A>
  ? A
  : never;
