import { TypedArray } from './typed-arrays.js';
export type CopyTextureOptions = {
    flipY?: boolean;
    mips?: boolean;
    premultipliedAlpha?: boolean;
    colorSpace?: PredefinedColorSpace;
    dimension?: GPUTextureDimension;
    viewDimension?: GPUTextureViewDimension;
    baseArrayLayer?: number;
    mipLevel?: number;
};
export type TextureData = {
    data: TypedArray | number[];
};
export type TextureCreationData = TextureData & {
    width?: number;
    height?: number;
};
export type TextureRawDataSource = TextureCreationData | TypedArray | number[];
export type TextureSource = GPUCopyExternalImageSourceInfo['source'] | TextureRawDataSource;
/**
 * Gets the size of a mipLevel. Returns an array of 3 numbers [width, height, depthOrArrayLayers]
 */
export declare function getSizeForMipFromTexture(texture: GPUTexture, mipLevel: number): number[];
/**
 * Copies a an array of "sources" (Video, Canvas, OffscreenCanvas, ImageBitmap, Array, TypedArray)
 * to a texture and then optionally generates mip levels
 *
 * Note that if the source is a `TypeArray`, then it will try to upload mips levels, then layers.
 * So, imagine you have a 4x4x3 2d-array r8unorm texture. If you pass in 16 bytes (4x4) it will
 * set mip level 0 layer 0 (4x4). If you pass in 24 bytes it will set mip level 0 layer 0(4x4)
 * and mip level 1 layer 0 (2x2). If you pass in 25 bytes it will set mip level 0, 1, 2, layer 0
 * If you pass in 75 bytes it would do all layers, all mip levels.
 *
 * Note that for 3d textures there are no "layers" from the POV of this function. There is mip level 0 (which is a cube)
 * and mip level 1 (which is a cube). So a '3d' 4x4x3 r8unorm texture, you're expected to provide 48 bytes for mip level 0
 * where as for '2d' 4x4x3 you're expected to provide 16 bytes for mip level 0 layer 0. If you want to provide data
 * to each layer separately then pass them in as an array
 *
 * ```js
 * // fill layer 0, mips 0
 * copySourcesToTexture(device, tex_4x4x3_r8_2d, [data16Bytes]);
 *
 * // fill layer 0, mips 0, 1, 2
 * copySourcesToTexture(device, tex_4x4x3_r8_2d, [data25Bytes]);
 *
 * // fill layer 0, mips 0, 1, 2, then layer 1, mips 0, 1, 2, then layer 2, mips 0, 1, 2
 * copySourcesToTexture(device, tex_4x4x3_r8_2d, [data75Bytes]);
 *
 * // (same as previous) fill layer 0, mips 0, 1, 2, then layer 1, mips 0, 1, 2, then layer 2, mips 0, 1, 2
 * copySourcesToTexture(device, tex_4x4x3_r8_2d, [data25Bytes, data25bytes, data25Bytes]);
 *
 * // fills layer 0, mips 0, layer 1, mips 0, layer 2, mips 0
 * copySourcesToTexture(device, tex_4x4x3_r8_2d, [data16Bytes, data16bytes, data16Bytes]);
 * ```
 *
 * This also works for compressed textures, so you can load an entire compressed texture, all mips, all layers in one call.
 * See texture-utils-tests.js for examples.
 *
 * If the source is an `Array` is it converted to a typed array that matches the format.
 *
 * * ????8snorm ????8sint -> `Int8Array`
 * * ????8unorm ????8uint -> `Uint8Array`
 * * ????16snorm ???16sint -> `Int16Array`
 * * ????16unorm ???16uint -> `Uint16Array`
 * * ????32snorm ???32sint -> `Int32Array`
 * * ????32unorm ???32uint -> `Uint32Array`
 * * ????16Float -> `Float16Array`
 * * ????32Float -> `Float32Array`
 * * rgb10a2uint, rgb10a2unorm, rg11b10ufloat, rgb8e5ufloat -> `UInt32Array`
 */
export declare function copySourcesToTexture(device: GPUDevice, texture: GPUTexture, sources: TextureSource[], options?: CopyTextureOptions): void;
/**
 * Copies a "source" (Video, Canvas, OffscreenCanvas, ImageBitmap, Array, TypedArray)
 * to a texture and then optionally generates mip levels
 * See {@link copySourcesToTexture}
 */
export declare function copySourceToTexture(device: GPUDevice, texture: GPUTexture, source: TextureSource, options?: CopyTextureOptions): void;
/**
 * @property mips if true and mipLevelCount is not set then wll automatically generate
 *    the correct number of mip levels.
 * @property format Defaults to "rgba8unorm"
 * @property mipLevelCount Defaults to 1 or the number of mips needed for a full mipmap if `mips` is true
 */
export type CreateTextureOptions = CopyTextureOptions & {
    usage?: GPUTextureUsageFlags;
    format?: GPUTextureFormat;
    mipLevelCount?: number;
    size?: GPUExtent3D;
};
/**
 * Gets the size from a source. This is to smooth out the fact that different
 * sources have a different way to get their size.
 */
export declare function getSizeFromSource(source: TextureSource, options: CreateTextureOptions): number[];
/**
 * Create a texture from an array of sources (Video, Canvas, OffscreenCanvas, ImageBitmap)
 * and optionally create mip levels. If you set `mips: true` and don't set a mipLevelCount
 * then it will automatically make the correct number of mip levels.
 *
 * Example:
 *
 * ```js
 * const texture = createTextureFromSource(
 *     device,
 *     [
 *        someCanvasOrVideoOrImageImageBitmap0,
 *        someCanvasOrVideoOrImageImageBitmap1,
 *     ],
 *     {
 *       usage: GPUTextureUsage.TEXTURE_BINDING |
 *              GPUTextureUsage.RENDER_ATTACHMENT |
 *              GPUTextureUsage.COPY_DST,
 *       mips: true,
 *     }
 * );
 * ```
 *
 * Note: If you are supporting compatibility mode you will need to pass in your
 * intended view dimension for cubemaps. Example:
 *
 * ```js
 * const texture = createTextureFromSource(
 *     device,
 *     [
 *        someCanvasOrVideoOrImageImageBitmapPosX,
 *        someCanvasOrVideoOrImageImageBitmapNegY,
 *        someCanvasOrVideoOrImageImageBitmapPosY,
 *        someCanvasOrVideoOrImageImageBitmapNegY,
 *        someCanvasOrVideoOrImageImageBitmapPosZ,
 *        someCanvasOrVideoOrImageImageBitmapNegZ,
 *     ],
 *     {
 *       usage: GPUTextureUsage.TEXTURE_BINDING |
 *              GPUTextureUsage.RENDER_ATTACHMENT |
 *              GPUTextureUsage.COPY_DST,
 *       mips: true,
 *       viewDimension: 'cube', // <=- Required for compatibility mode
 *     }
 * );
 * ```
 */
export declare function createTextureFromSources(device: GPUDevice, sources: TextureSource[], options?: CreateTextureOptions): GPUTexture;
/**
 * Create a texture from a source (Video, Canvas, OffscreenCanvas, ImageBitmap)
 * and optionally create mip levels. If you set `mips: true` and don't set a mipLevelCount
 * then it will automatically make the correct number of mip levels.
 *
 * Example:
 *
 * ```js
 * const texture = createTextureFromSource(
 *     device,
 *     someCanvasOrVideoOrImageImageBitmap,
 *     {
 *       usage: GPUTextureUsage.TEXTURE_BINDING |
 *              GPUTextureUsage.RENDER_ATTACHMENT |
 *              GPUTextureUsage.COPY_DST,
 *       mips: true,
 *     }
 * );
 * ```
 */
export declare function createTextureFromSource(device: GPUDevice, source: TextureSource, options?: CreateTextureOptions): GPUTexture;
export type CreateTextureFromBitmapOptions = CreateTextureOptions & ImageBitmapOptions;
/**
 * Load an ImageBitmap
 * @param url
 * @param options
 * @returns the loaded ImageBitmap
 */
export declare function loadImageBitmap(url: string, options?: ImageBitmapOptions): Promise<ImageBitmap>;
/**
 * Load images and create a texture from them, optionally generating mip levels
 *
 * Assumes all the urls reference images of the same size.
 *
 * Example:
 *
 * ```js
 * const texture = await createTextureFromImage(
 *   device,
 *   [
 *     'https://someimage1.url',
 *     'https://someimage2.url',
 *   ],
 *   {
 *     mips: true,
 *     flipY: true,
 *   },
 * );
 * ```
 */
export declare function createTextureFromImages(device: GPUDevice, urls: string[], options?: CreateTextureFromBitmapOptions): Promise<GPUTexture>;
/**
 * Load an image and create a texture from it, optionally generating mip levels
 *
 * Example:
 *
 * ```js
 * const texture = await createTextureFromImage(device, 'https://someimage.url', {
 *   mips: true,
 *   flipY: true,
 * });
 * ```
 */
export declare function createTextureFromImage(device: GPUDevice, url: string, options?: CreateTextureFromBitmapOptions): Promise<GPUTexture>;
