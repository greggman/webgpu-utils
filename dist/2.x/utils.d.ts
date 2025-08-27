export declare const roundUpToMultipleOf: (v: number, multiple: number) => number;
export declare function keysOf<T extends string>(obj: {
    [k in T]: unknown;
}): readonly T[];
export declare function range<T>(count: number, fn: (i: number) => T): T[];
export declare function normalizeExtent3D(extent: GPUExtent3D): [number, number, number];
export declare function normalizeOrigin3D(origin?: GPUOrigin3D): [number, number, number];
export declare function addOrigin3D(a?: GPUOrigin3D, b?: GPUOrigin3D): [number, number, number];
