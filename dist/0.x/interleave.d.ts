/// <reference types="dist" />
import { TypedArray, TypedArrayConstructor } from './typed-arrays.js';
export type FullArraySpec = {
    data: number[] | TypedArray;
    type?: TypedArrayConstructor;
    numComponents?: number;
    shaderLocation?: number;
    normalize?: boolean;
};
export type ArrayUnion = number[] | TypedArray | FullArraySpec;
export type Arrays = {
    [key: string]: ArrayUnion;
};
export type ArraysOptions = {
    interleave?: boolean;
    stepMode?: GPUVertexStepMode;
    usage?: GPUBufferUsageFlags;
    shaderLocation?: number;
};
export type BufferInfo = {
    numElements: number;
    bufferLayout: GPUVertexBufferLayout;
    buffer: GPUBuffer;
    indexBuffer?: GPUBuffer;
    indexFormat?: GPUIndexFormat;
};
export declare function normalizeArray(srcMin: number, srcMax: number, dstMin: number, dstMax: number, array: number[] | TypedArray): Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | number[];
/**
 * Given arrays, create buffers, fill the buffers with data, optionally
 * interleave the data.
 * @param arrays
 * @param options
 */
export declare function createBufferInfoFromArrays(device: GPUDevice, arrays: Arrays, options?: ArraysOptions): BufferInfo;
