export type TypedArrayConstructor = Int8ArrayConstructor | Uint8ArrayConstructor | Uint8ClampedArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float16ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor;
export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float16Array | Float32Array | Float64Array;
export declare class TypedArrayViewGenerator {
    arrayBuffer: ArrayBuffer;
    byteOffset: number;
    constructor(sizeInBytes: number);
    align(alignment: number): void;
    pad(numBytes: number): void;
    getView<T extends TypedArray>(Ctor: TypedArrayConstructor, numElements: number): T;
}
export declare function subarray<T extends TypedArray>(arr: TypedArray, offset: number, length: number): T;
export declare const isTypedArray: (arr: any) => any;
