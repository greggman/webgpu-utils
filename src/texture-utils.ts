import { TypedArray, TypedArrayConstructor } from './buffer-views.js';
import {
  generateMipmap,
  numMipLevels,
} from './generate-mipmap.js';
import { isTypedArray } from './utils.js';

export type CopyTextureOptions = {
  flipY?: boolean,
  premultipliedAlpha?: boolean,
  colorSpace?: PredefinedColorSpace;
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
export function copySourceToTexture(
    device: GPUDevice,
    texture: GPUTexture,
    source: GPUImageCopyExternalImage['source'],
    options: CopyTextureOptions = {}) {
  const {flipY, premultipliedAlpha, colorSpace} = options;
  
  device.queue.copyExternalImageToTexture(
    { source, flipY, },
    { texture, premultipliedAlpha, colorSpace },
    { width: source.width, height: source.height },
  );

  if (texture.mipLevelCount > 1) {
    generateMipmap(device, texture);
  }
}

/**
 * @property mips if true and mipLevelCount is not set then wll automatically generate
 *    the correct number of mip levels.
 * @property format Defaults to "rgba8unorm"
 * @property mipLeveLCount Defaults to 1 or the number of mips needed for a full mipmap if `mips` is true
 */
export type CreateTextureOptions = CopyTextureOptions & {
  mips?: boolean,
  usage?: GPUTextureUsageFlags,
  format?: GPUTextureFormat,
  mipLevelCount?: number,
};

export function getSizeFromSource(source: GPUImageCopyExternalImage['source']) {
  if (source instanceof HTMLVideoElement) {
    return [source.videoWidth, source.videoHeight];
  } else {
    return [source.width, source.height];
  }
}

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
export function createTextureFromSource(
    device: GPUDevice,
    source: GPUImageCopyExternalImage['source'],
    options: CreateTextureOptions = {}) {
  const size = getSizeFromSource(source);
  const texture = device.createTexture({
    format: options.format || 'rgba8unorm',
    mipLevelCount: options.mipLevelCount
        ? options.mipLevelCount
        : options.mips ? numMipLevels(size) : 1,
    size,
    usage: (options.usage ?? 0) |
           GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_DST |
           GPUTextureUsage.RENDER_ATTACHMENT,
  });
  copySourceToTexture(device, texture, source, options);
  return texture;
}

export type CreateTextureFromBitmapOptions = CreateTextureOptions & ImageBitmapOptions;

/**
 * Load an ImageBitmap
 * @param url 
 * @param options 
 * @returns the loaded ImageBitmap
 */
export async function loadImageBitmap(url: string, options: ImageBitmapOptions = {}) {
  const res = await fetch(url);
  const blob = await res.blob();
  const opt: ImageBitmapOptions = {
    ...options,
    ...(options.colorSpaceConversion !== undefined && {colorSpaceConversion: 'none'}),
  };
  return await createImageBitmap(blob, opt);
}

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
export async function createTextureFromImage(device: GPUDevice, url: string, options: CreateTextureFromBitmapOptions = {}) {
  const imgBitmap = await loadImageBitmap(url);
  return createTextureFromSource(device, imgBitmap, options);
}
