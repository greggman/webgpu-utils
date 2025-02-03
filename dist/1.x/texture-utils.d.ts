import { TypedArray } from './typed-arrays.js';
export type CopyTextureOptions = {
    flipY?: boolean;
    premultipliedAlpha?: boolean;
    colorSpace?: PredefinedColorSpace;
    dimension?: GPUTextureViewDimension;
    baseArrayLayer?: number;
};
export type TextureData = {
    data: TypedArray | number[];
};
export type TextureCreationData = TextureData & {
    width?: number;
    height?: number;
};
export type TextureRawDataSource = TextureCreationData | TypedArray | number[];
export type TextureSource = GPUImageCopyExternalImage['source'] | TextureRawDataSource;
/**
 * Gets the size of a mipLevel. Returns an array of 3 numbers [width, height, depthOrArrayLayers]
 */
export declare function getSizeForMipFromTexture(texture: GPUTexture, mipLevel: number): number[];
/**
 * Copies a an array of "sources" (Video, Canvas, OffscreenCanvas, ImageBitmap)
 * to a texture and then optionally generates mip levels
 */
export declare function copySourcesToTexture(device: GPUDevice, texture: GPUTexture, sources: TextureSource[], options?: CopyTextureOptions): void;
/**
 * Copies a "source" (Video, Canvas, OffscreenCanvas, ImageBitmap)
 * to a texture and then optionally generates mip levels
 */
export declare function copySourceToTexture(device: GPUDevice, texture: GPUTexture, source: TextureSource, options?: CopyTextureOptions): void;
/**
 * @property mips if true and mipLevelCount is not set then wll automatically generate
 *    the correct number of mip levels.
 * @property format Defaults to "rgba8unorm"
 * @property mipLeveLCount Defaults to 1 or the number of mips needed for a full mipmap if `mips` is true
 */
export type CreateTextureOptions = CopyTextureOptions & {
    mips?: boolean;
    usage?: GPUTextureUsageFlags;
    format?: GPUTextureFormat;
    mipLevelCount?: number;
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
