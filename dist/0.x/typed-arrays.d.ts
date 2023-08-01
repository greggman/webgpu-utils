export type TypedArrayConstructor = Int8ArrayConstructor | Uint8ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor;
export type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;
export declare class TypedArrayViewGenerator {
    arrayBuffer: ArrayBuffer;
    byteOffset: number;
    constructor(sizeInBytes: number);
    align(alignment: number): void;
    pad(numBytes: number): void;
    getView<T extends TypedArray>(Ctor: TypedArrayConstructor, numElements: number): T;
}
export declare const isTypedArray: (arr: any) => any;
