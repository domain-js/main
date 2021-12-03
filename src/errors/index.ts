interface MyError {
  message: string;
  code?: string | number;
  data?: any;
}

interface ErrorFn {
  (...args: any): MyError;
}

type RemoveReadonlyArray<T extends readonly any[]> = T extends readonly (infer A)[]
  ? A extends readonly [infer key, any]
    ? key
    : never
  : never;

/**
 * Convert error configuration to errors function
 * @param defines error configuration
 * @returns errors function
 */
export function Errors<T extends ReadonlyArray<readonly [string, string]>>(defines: T) {
  const errors: any = {};
  for (const [code, msg] of defines) {
    errors[code] = (...args: any) => {
      if (Array.isArray(args) && args.length === 1) {
        const [first] = args;
        // 只有一个参数且，参数已经是一个封装后的
        if (first && first.code) return first;
      }

      return Object.assign(new Error(msg), {
        code,
        data: args,
      }) as MyError;
    };
  }

  return errors as Record<RemoveReadonlyArray<T>, ErrorFn>;
}
