export const roundUpToMultipleOf = (v: number, multiple: number) => (((v + multiple - 1) / multiple) | 0) * multiple;

export function keysOf<T extends string>(obj: { [k in T]: unknown }): readonly T[] {
  return (Object.keys(obj) as unknown[]) as T[];
}

export function range<T>(count: number, fn: (i: number) => T) {
    return new Array(count).fill(0).map((_, i) => fn(i));
}

const isIterable = (v: any) =>
  v != null && typeof v[Symbol.iterator] === 'function';

export function normalizeExtent3D(extent: GPUExtent3D): [number, number, number] {
  if (!extent) {
    return [1, 1, 1];
  }
  if (isIterable(extent)) {
    const [w, h = 1, d = 1] = [...extent as number[]];
    return [w, h, d];
  }
  const { width = 1, height = 1, depthOrArrayLayers = 1 } = extent as GPUExtent3DDict;
  return [width, height, depthOrArrayLayers];
}

export function normalizeOrigin3D(origin?: GPUOrigin3D): [number, number, number] {
  if (!origin) {
    return [0, 0, 0];
  }
  if (isIterable(origin)) {
    const [x, y = 0, z = 0] = [...origin as number[]];
    return [x, y, z];
  }
  const { x = 0, y = 0, z = 0 } = origin as GPUOrigin3DDict;
  return [x, y, z];
}

export function addOrigin3D(a?: GPUOrigin3D, b?: GPUOrigin3D): [number, number, number] {
  const an = normalizeOrigin3D(a);
  const bn = normalizeOrigin3D(b);
  return an.map((v, i) => v + bn[i]) as [number, number, number];
}