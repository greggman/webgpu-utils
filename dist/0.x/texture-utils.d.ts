/// <reference types="dist" />
type CopyTextureOptions = {
    flipY?: boolean;
};
export declare function copySourceToTexture(device: GPUDevice, texture: GPUTexture, source: GPUImageCopyExternalImage['source'], { flipY }?: CopyTextureOptions): void;
type CreateTextureOptions = CopyTextureOptions & {
    mips?: boolean;
    usage?: GPUTextureUsageFlags;
    format?: GPUTextureFormat;
};
export declare function getSizeFromSource(source: GPUImageCopyExternalImage['source']): number[];
export declare function createTextureFromSource(device: GPUDevice, source: GPUImageCopyExternalImage['source'], options?: CreateTextureOptions): GPUTexture;
type CreateTextureFromBitmapOptions = CreateTextureOptions & ImageBitmapOptions;
export declare function loadImageBitmap(url: string, options?: ImageBitmapOptions): Promise<ImageBitmap>;
export declare function createTextureFromImage(device: GPUDevice, url: string, options?: CreateTextureFromBitmapOptions): Promise<GPUTexture>;
export {};
