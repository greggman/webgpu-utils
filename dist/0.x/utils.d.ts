export declare const roundUpToMultipleOf: (v: number, multiple: number) => number;
export declare function keysOf<T extends string>(obj: {
    [k in T]: unknown;
}): readonly T[];
export declare function range<T>(count: number, fn: (i: number) => T): T[];
