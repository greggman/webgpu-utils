/// <reference types="dist" />
export type CopyTextureOptions = {
    flipY?: boolean;
};
/**
 * Copies a "source" (Video, Canvas, OffscreenCanvas, ImageBitmap)
 * to a texture and then optionally generates mip levels
 *
 * @param device
 * @param texture The texture to copy to
 * @param source The source to copy from
 * @param options use `{flipY: true}` if you want the source flipped
 */
export declare function copySourceToTexture(device: GPUDevice, texture: GPUTexture, source: GPUImageCopyExternalImage['source'], options?: CopyTextureOptions): void;
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
export declare function getSizeFromSource(source: GPUImageCopyExternalImage['source']): number[];
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
export declare function createTextureFromSource(device: GPUDevice, source: GPUImageCopyExternalImage['source'], options?: CreateTextureOptions): GPUTexture;
export type CreateTextureFromBitmapOptions = CreateTextureOptions & ImageBitmapOptions;
/**
 * Load an ImageBitmap
 * @param url
 * @param options
 * @returns the loaded ImageBitmap
 */
export declare function loadImageBitmap(url: string, options?: ImageBitmapOptions): Promise<ImageBitmap>;
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
