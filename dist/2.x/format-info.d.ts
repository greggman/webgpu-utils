import { TypedArrayConstructor } from "./typed-arrays.js";
export type FormatInfo = {
    blockWidth: number;
    blockHeight: number;
    bytesPerBlock: number;
    unitsPerElement: number;
    Type: TypedArrayConstructor;
};
export declare function getTextureFormatInfo(format: GPUTextureFormat): FormatInfo;
