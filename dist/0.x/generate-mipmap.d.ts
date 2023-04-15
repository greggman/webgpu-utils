/// <reference types="dist" />
export declare function normalizeGPUExtent3D(size: GPUExtent3D): number[];
export declare function numMipLevels(size: GPUExtent3D): number;
export declare function generateMipmap(device: GPUDevice, texture: GPUTexture): void;
