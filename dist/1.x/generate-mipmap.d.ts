export declare function guessTextureBindingViewDimensionForTexture(dimension: GPUTextureDimension | undefined, depthOrArrayLayers: number): GPUTextureViewDimension;
/**
 * Converts a `GPUExtent3D` into an array of numbers
 *
 * `GPUExtent3D` has two forms `[width, height?, depth?]` or
 * `{width: number, height?: number, depthOrArrayLayers?: number}`
 *
 * You pass one of those in here and it returns an array of 3 numbers
 * so that your code doesn't have to deal with multiple forms.
 *
 * @param size
 * @returns an array of 3 numbers, [width, height, depthOrArrayLayers]
 */
export declare function normalizeGPUExtent3D(size: GPUExtent3D): number[];
/**
 * Given a GPUExtent3D returns the number of mip levels needed
 *
 * @param size
 * @returns number of mip levels needed for the given size
 */
export declare function numMipLevels(size: GPUExtent3D, dimension?: GPUTextureDimension): number;
/**
 * Generates mip levels from level 0 to the last mip for an existing texture
 *
 * The texture must have been created with TEXTURE_BINDING and RENDER_ATTACHMENT
 * and been created with mip levels
 *
 * @param device A GPUDevice
 * @param texture The texture to create mips for
 * @param textureBindingViewDimension This is only needed in compatibility mode
 *   and it is only needed when the texture is going to be used as a cube map.
 */
export declare function generateMipmap(device: GPUDevice, texture: GPUTexture, textureBindingViewDimension?: GPUTextureViewDimension): void;
