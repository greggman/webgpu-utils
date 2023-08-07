/// <reference types="dist" />
import { TypedArray, TypedArrayConstructor } from './typed-arrays.js';
/**
 * See {@link Arrays} for details
 */
export type FullArraySpec = {
    data: number | number[] | TypedArray;
    type?: TypedArrayConstructor;
    numComponents?: number;
    shaderLocation?: number;
    normalize?: boolean;
};
export type ArrayUnion = number | number[] | TypedArray | FullArraySpec;
/**
 * Named Arrays
 *
 * A set of named arrays are passed to various functions like
 * {@link createBufferLayoutsFromArrays} and {@link createBuffersAndAttributesFromArrays}
 *
 * Each array can be 1 of 4 things. A native JavaScript array, a TypedArray, a number, a {@link FullArraySpec}
 *
 * If it's a native array then, if the name of the array is `indices` the data will be converted
 * to a `Uint32Array`, otherwise a `Float32Array.  Use a TypedArray or a FullArraySpec to choose a different type.
 * The FullArraySpec type is only used if it's not already a TypedArray
 *
 * If it's a native array or a TypedArray or if `numComponents` in a {@link FullArraySpec} is not
 * specified it will be guess. If the name contains 'coord', 'texture' or 'uv' then numComponents will be 2.
 * If the name contains 'color' or 'colour' then numComponents will be 4. Otherwise it's 3.
 *
 * For attribute formats, guesses are made based on type at number of components. The guess is
 * based on this table where (d) is the default for that type if `normalize` is not specified
 *
 * | Type          |     ..      | normalize   |
 * | ------------  | ----------- | ----------- |
 * | Int8Array     | sint8       | snorm8 (d)  |
 * | Uint8Array    | uint8       | unorm8 (d)  |
 * | Int16Array    | sint16      | snorm16 (d) |
 * | Uint16Array   | uint16      | unorm16 (d) |
 * | Int32Array    | sint32 (d)  | snorm32     |
 * | Uint32Array   | uint32 (d)  | unorm32     |
 * | Float32Array  | float32 (d) | float32     |
 *
 */
export type Arrays = {
    [key: string]: ArrayUnion;
};
export type ArraysOptions = {
    interleave?: boolean;
    stepMode?: GPUVertexStepMode;
    usage?: GPUBufferUsageFlags;
    shaderLocation?: number;
};
/**
 * Returned by {@link createBuffersAndAttributesFromArrays}
 */
export type BuffersAndAttributes = {
    numElements: number;
    bufferLayouts: GPUVertexBufferLayout[];
    buffers: GPUBuffer[];
    indexBuffer?: GPUBuffer;
    indexFormat?: GPUIndexFormat;
};
type TypedArrayWithOffsetAndStride = {
    data: TypedArray;
    offset: number; /** In elements not bytes */
    stride: number; /** In elements not bytes */
};
/**
 * Given a set of named arrays, generates an array `GPUBufferLayout`s
 *
 * Examples:
 *
 * ```js
 *   const arrays = {
 *     position: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
 *     normal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
 *     texcoord: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
 *   };
 *
 *   const { bufferLayouts, typedArrays } = createBufferLayoutsFromArrays(arrays);
 * ```
 *
 * results in `bufferLayouts` being
 *
 * ```js
 * [
 *   {
 *     stepMode: 'vertex',
 *     arrayStride: 32,
 *     attributes: [
 *       { shaderLocation: 0, offset:  0, format: 'float32x3' },
 *       { shaderLocation: 1, offset: 12, format: 'float32x3' },
 *       { shaderLocation: 2, offset: 24, format: 'float32x2' },
 *     ],
 *   },
 * ]
 * ```
 *
 * and `typedArrays` being
 *
 * ```
 * [
 *   someFloat32Array0,
 *   someFloat32Array1,
 *   someFloat32Array2,
 * ]
 * ```
 *
 * See {@link Arrays} for details on the various types of arrays.
 *
 * Note: If typed arrays are passed in the same typed arrays will come out (copies will not be made)
 */
export declare function createBufferLayoutsFromArrays(arrays: Arrays, options?: ArraysOptions): {
    bufferLayouts: GPUVertexBufferLayout[];
    typedArrays: TypedArrayWithOffsetAndStride[];
};
/**
 * Given an array of `GPUVertexAttribute`s and a corresponding array
 * of TypedArrays, interleaves the contents of the typed arrays
 * into the given ArrayBuffer
 *
 * example:
 *
 * ```js
 * const attributes: GPUVertexAttribute[] = [
 *   { shaderLocation: 0, offset:  0, format: 'float32x3' },
 *   { shaderLocation: 1, offset: 12, format: 'float32x3' },
 *   { shaderLocation: 2, offset: 24, format: 'float32x2' },
 * ];
 * const typedArrays = [
 *   new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]),
 *   new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
 *   new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]),
 * ];
 * const arrayStride = (3 + 3 + 2) * 4;  // pos + nrm + uv
 * const arrayBuffer = new ArrayBuffer(arrayStride * 24)
 * interleaveVertexData(attributes, typedArrays, arrayStride, arrayBuffer)
 * ```
 *
 * results in the contents of `arrayBuffer` to be the 3 TypedArrays interleaved
 *
 * See {@link Arrays} for details on the various types of arrays.
 *
 * Note: You can generate `attributes` and `typedArrays` above by calling
 * {@link createBufferLayoutsFromArrays}
 */
export declare function interleaveVertexData(attributes: GPUVertexAttribute[], typedArrays: (TypedArray | TypedArrayWithOffsetAndStride)[], arrayStride: number, arrayBuffer: ArrayBuffer): void;
/**
 * Given arrays, create buffers, fills the buffers with data if provided, optionally
 * interleaves the data (the default).
 *
 * Example:
 *
 * ```js
 *  const {
 *    buffers,
 *    bufferLayouts,
 *    indexBuffer,
 *    indexFormat,
 *    numElements,
 *  } = createBuffersAndAttributesFromArrays(device, {
 *    position: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
 *    normal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
 *    texcoord: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
 *    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
 *  });
 * ```
 *
 * Where `bufferLayouts` will be
 *
 * ```js
 * [
 *   {
 *     stepMode: 'vertex',
 *     arrayStride: 32,
 *     attributes: [
 *       { shaderLocation: 0, offset:  0, format: 'float32x3' },
 *       { shaderLocation: 1, offset: 12, format: 'float32x3' },
 *       { shaderLocation: 2, offset: 24, format: 'float32x2' },
 *     ],
 *   },
 * ]
 * ```
 *
 * * `buffers` will have one `GPUBuffer` of usage `GPUBufferUsage.VERTEX`
 * * `indexBuffer` will be `GPUBuffer` of usage `GPUBufferUsage.INDEX`
 * * `indexFormat` will be `uint32` (use a full spec or a typedarray of `Uint16Array` if you want 16bit indices)
 * * `numElements` will be 36 (this is either the number entries in the array named `indices` or if no
 *    indices are provided then it's the length of the first array divided by numComponents. See {@link Arrays})
 *
 * See {@link Arrays} for details on the various types of arrays.
 * Also see the cube and instancing examples.
 */
export declare function createBuffersAndAttributesFromArrays(device: GPUDevice, arrays: Arrays, options?: ArraysOptions): BuffersAndAttributes;
export {};
