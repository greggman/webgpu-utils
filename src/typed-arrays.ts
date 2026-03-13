import {
    roundUpToMultipleOf,
} from './utils.js';

export type TypedArrayConstructor =
    | Int8ArrayConstructor
    | Uint8ArrayConstructor
    | Uint8ClampedArrayConstructor
    | Int16ArrayConstructor
    | Uint16ArrayConstructor
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Float16ArrayConstructor
    | Float32ArrayConstructor
    | Float64ArrayConstructor;

export type TypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float16Array
    | Float32Array
    | Float64Array;

export class TypedArrayViewGenerator {
    arrayBuffer: ArrayBuffer;
    byteOffset: number;

    constructor(sizeInBytes: number) {
        this.arrayBuffer = new ArrayBuffer(sizeInBytes);
        this.byteOffset = 0;
    }
    align(alignment: number) {
        this.byteOffset = roundUpToMultipleOf(this.byteOffset, alignment);
    }
    pad(numBytes: number) {
        this.byteOffset += numBytes;
    }
    getView<T extends TypedArray>(Ctor: TypedArrayConstructor, numElements: number): T {
        const view = new Ctor(this.arrayBuffer, this.byteOffset, numElements);
        this.byteOffset += view.byteLength;
        return view as T;
    }
}

export function subarray<T extends TypedArray>(arr: TypedArray, offset: number, length: number): T {
  return arr.subarray(offset, offset + length) as T;
}

export const isTypedArray = (arr: any) => ArrayBuffer.isView(arr) && !(arr instanceof DataView);
