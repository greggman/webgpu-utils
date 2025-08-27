import {
  TypedArray,
  isTypedArray,
} from './typed-arrays.js';
import {
  generateMipmap,
  numMipLevels,
  guessTextureBindingViewDimensionForTexture,
} from './generate-mipmap.js';
import {
  getTextureFormatInfo,
} from './format-info.js';
import { addOrigin3D, normalizeExtent3D } from './utils.js';

export type CopyTextureOptions = {
  flipY?: boolean,
  mips?: boolean,
  premultipliedAlpha?: boolean,
  colorSpace?: PredefinedColorSpace;
  dimension?: GPUTextureDimension;
  viewDimension?: GPUTextureViewDimension;
  baseArrayLayer?: number;
  mipLevel?: number;
};

export type TextureData = {
  data: TypedArray | number[],
};
export type TextureCreationData = TextureData & {
  width?: number,
  height?: number,
};

export type TextureRawDataSource = TextureCreationData | TypedArray | number[];
export type TextureSource = GPUCopyExternalImageSourceInfo['source'] | TextureRawDataSource;

function isTextureData(source: TextureSource) {
  const src = source as TextureData;
  return isTypedArray(src.data) || Array.isArray(src.data);
}

function isTextureRawDataSource(source: TextureSource) {
  return isTypedArray(source) || Array.isArray(source) || isTextureData(source);
}

function toTypedArray(v: TypedArray | number[], format: GPUTextureFormat): TypedArray {
  if (isTypedArray(v)) {
    return v as TypedArray;
  }
  const { Type } = getTextureFormatInfo(format);
  return new Type(v);
}

function guessDimensions(width: number | undefined, height: number | undefined, numElements: number, dimension: GPUTextureViewDimension = '2d'): number[] {
  if (numElements % 1 !== 0) {
    throw new Error("can't guess dimensions");
  }
  if (!width && !height) {
    const size = Math.sqrt(numElements / (dimension === 'cube' ? 6 : 1));
    if (size % 1 === 0) {
      width = size;
      height = size;
    } else {
      width = numElements;
      height = 1;
    }
  } else if (!height) {
    height = numElements / width!;
    if (height % 1) {
      throw new Error("can't guess dimensions");
    }
  } else if (!width) {
    width = numElements / height;
    if (width % 1) {
      throw new Error("can't guess dimensions");
    }
  }
  const depth = numElements / width! / height;
  if (depth % 1) {
    throw new Error("can't guess dimensions");
  }
  return [width!, height, depth];
}

function textureViewDimensionToDimension(viewDimension: GPUTextureViewDimension | undefined) {
  switch (viewDimension) {
    case '1d': return '1d';
    case '3d': return '3d';
    default: return '2d';
  }
}

/**
 * Gets the size of a mipLevel. Returns an array of 3 numbers [width, height, depthOrArrayLayers]
 */
export function getSizeForMipFromTexture(texture: GPUTexture, mipLevel: number): number[] {
  return [
    texture.width,
    texture.height,
    texture.depthOrArrayLayers,
  ].map((v, i) => i < 3 || texture.dimension !== '3d' ? Math.max(1, Math.floor(v / 2 ** mipLevel)) : texture.depthOrArrayLayers);
}

/**
 * Uploads Data to a texture
 */
function uploadDataToTexture(
  device: GPUDevice,
  texture: GPUTexture,
  source: TextureRawDataSource,
  options: { origin?: GPUOrigin3D, mipLevel?: number },
) {
  const data = toTypedArray((source as TextureData).data || source, texture.format);
  let dataOffset = 0;
  let localLayer = 0;
  let mipLevel = options.mipLevel ?? 0;
  while (dataOffset < data.byteLength) {
    const size = getSizeForMipFromTexture(texture, mipLevel);
    const { blockWidth, blockHeight, bytesPerBlock } = getTextureFormatInfo(texture.format);
    const blocksAcross = Math.ceil(size[0] / blockWidth);
    const blocksDown = Math.ceil(size[1] / blockHeight);
    const bytesPerRow = blocksAcross * bytesPerBlock!;
    const bytesPerLayer = bytesPerRow * blocksDown;
    const numLayers = texture.dimension === '3d'
      ? data.byteLength / bytesPerLayer
      : 1;
    size[0] = blocksAcross * blockWidth;
    size[1] = blocksDown * blockHeight;
    size[2] = numLayers;
    const origin = addOrigin3D(options.origin ?? [0, 0, 0], [0, 0, localLayer]);
    device.queue.writeTexture(
      { texture, origin, mipLevel },
      data as unknown as GPUAllowSharedBufferSource,
      {
        bytesPerRow: bytesPerBlock * blocksAcross,
        rowsPerImage: blocksDown,
        offset: dataOffset,
      },
      size,
    );
    const bytesUsed = size[2] * bytesPerLayer;
    dataOffset += bytesUsed;
    ++mipLevel;
    if (mipLevel === texture.mipLevelCount) {
      mipLevel = options.mipLevel ?? 0;
      ++localLayer;
    }
  }
}
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
export function copySourcesToTexture(
    device: GPUDevice,
    texture: GPUTexture,
    sources: TextureSource[],
    options: CopyTextureOptions = {},
) {
  let tempTexture: GPUTexture | undefined;
  sources.forEach((source, layer) => {
    const origin = [0, 0, layer + (options.baseArrayLayer || 0)];
    if (isTextureRawDataSource(source)) {
      uploadDataToTexture(device, texture, source as TextureRawDataSource, { origin });
    } else {
      const s = source as GPUCopyExternalImageSourceInfo['source'];
      // work around limit that you can't call copyExternalImageToTexture for 3d texture.
      // sse https://github.com/gpuweb/gpuweb/issues/4697 for if we can remove this
      let dstTexture = texture;
      let copyOrigin = origin;
      if (texture.dimension === '3d') {
        tempTexture = tempTexture ?? device.createTexture({
          format: texture.format,
          usage: texture.usage | GPUTextureUsage.COPY_SRC,
          size: [texture.width, texture.height, 1],
        });
        dstTexture = tempTexture;
        copyOrigin = [0, 0, 0];
      }

      const {flipY, premultipliedAlpha, colorSpace} = options;
      device.queue.copyExternalImageToTexture(
        { source: s, flipY, },
        { texture: dstTexture, premultipliedAlpha, colorSpace, origin: copyOrigin },
        getSizeFromSource(s, options),
      );

      if (tempTexture) {
        const encoder = device.createCommandEncoder();
        encoder.copyTextureToTexture(
          { texture: tempTexture },
          { texture, origin },
          tempTexture,
        );
        device.queue.submit([encoder.finish()]);
      }
    }
  });

  if (tempTexture) {
    tempTexture.destroy();
  }

  if (options.mips) {
    const viewDimension =  options.viewDimension ?? guessTextureBindingViewDimensionForTexture(
      texture.dimension, texture.depthOrArrayLayers);
    generateMipmap(device, texture, viewDimension);
  }
}


/**
 * Copies a "source" (Video, Canvas, OffscreenCanvas, ImageBitmap, Array, TypedArray)
 * to a texture and then optionally generates mip levels
 * See {@link copySourcesToTexture}
 */
export function copySourceToTexture(
    device: GPUDevice,
    texture: GPUTexture,
    source: TextureSource,
    options: CopyTextureOptions = {}) {
  copySourcesToTexture(device, texture, [source], options);
}

/**
 * @property mips if true and mipLevelCount is not set then wll automatically generate
 *    the correct number of mip levels.
 * @property format Defaults to "rgba8unorm"
 * @property mipLevelCount Defaults to 1 or the number of mips needed for a full mipmap if `mips` is true
 */
export type CreateTextureOptions = CopyTextureOptions & {
  usage?: GPUTextureUsageFlags,
  format?: GPUTextureFormat,
  mipLevelCount?: number,
  size?: GPUExtent3D,
};

/**
 * Gets the size from a source. This is to smooth out the fact that different
 * sources have a different way to get their size.
 */
export function getSizeFromSource(source: TextureSource, options: CreateTextureOptions): number[] {
  if ('videoWidth' in source && 'videoHeight' in source) {
    return [source.videoWidth, source.videoHeight, 1];
  } else {
    const maybeHasWidthAndHeight = source as { width: number, height: number };
    let { width, height } = maybeHasWidthAndHeight;
    if (width > 0 && height > 0 && !isTextureRawDataSource(source)) {
      // this should cover Canvas, Image, ImageData, ImageBitmap, TextureCreationData
      return [width, height, 1];
    }
    if (options.size) {
      let depthOrArrayLayers;
      if (Array.isArray(options.size)) {
        [ width, height, depthOrArrayLayers ] = options.size;
      } else {
        width = (options.size as GPUExtent3DDict).width;
        height = (options.size as GPUExtent3DDict).height!;
        depthOrArrayLayers = (options.size as GPUExtent3DDict).depthOrArrayLayers!;
      }
      if (width > 0 && height > 0) {
        return normalizeExtent3D([width, height, depthOrArrayLayers]);
      }
    }
    const format = options.format || 'rgba8unorm';
    const { bytesPerBlock, Type } = getTextureFormatInfo(format);
    const data = isTypedArray(source) || Array.isArray(source)
       ? source
       : (source as TextureData).data;
    const numBytes = isTypedArray(data)
        ? (data as TypedArray).byteLength
        : ((data as number[]).length * Type.BYTES_PER_ELEMENT);
    const numElements = numBytes / bytesPerBlock;
    return guessDimensions(width, height, numElements);
  }
}

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
export function createTextureFromSources(
    device: GPUDevice,
    sources: TextureSource[],
    options: CreateTextureOptions = {}): GPUTexture {
  // NOTE: We assume all the sizes are the same. If they are not you'll get
  // an error.
  const size = getSizeFromSource(sources[0], options);
  size[2] = size[2] > 1 ? size[2] : sources.length;

  const viewDimension = options.viewDimension ?? guessTextureBindingViewDimensionForTexture(
    options.dimension, size[2]);
  const dimension = textureViewDimensionToDimension(viewDimension);
  const format = options.format ?? 'rgba8unorm';
  const { blockWidth, blockHeight } = getTextureFormatInfo(format);
  const compressed = blockWidth > 1 || blockHeight > 1;
  const texture = device.createTexture({
    dimension,
    textureBindingViewDimension: viewDimension,
    format,
    mipLevelCount: options.mipLevelCount
        ? options.mipLevelCount
        : options.mips ? numMipLevels(size) : 1,
    size,
    usage: (options.usage ?? 0) |
           GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_DST |
           (compressed ? 0 : GPUTextureUsage.RENDER_ATTACHMENT),
  });

  copySourcesToTexture(device, texture, sources, options);

  return texture;
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
    source: TextureSource,
    options: CreateTextureOptions = {}): GPUTexture {
  return createTextureFromSources(device, [source], options);
}

export type CreateTextureFromBitmapOptions = CreateTextureOptions & ImageBitmapOptions;

/**
 * Load an ImageBitmap
 * @param url
 * @param options
 * @returns the loaded ImageBitmap
 */
export async function loadImageBitmap(url: string, options: ImageBitmapOptions = {}): Promise<ImageBitmap> {
  const res = await fetch(url);
  const blob = await res.blob();
  const opt: ImageBitmapOptions = {
    ...options,
    ...(options.colorSpaceConversion !== undefined && {colorSpaceConversion: 'none'}),
  };
  return await createImageBitmap(blob, opt);
}

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
export async function createTextureFromImages(device: GPUDevice, urls: string[], options: CreateTextureFromBitmapOptions = {}): Promise<GPUTexture> {
  // TODO: start once we've loaded one?
  // We need at least 1 to know the size of the texture to create
  const imgBitmaps = await Promise.all(urls.map(url => loadImageBitmap(url)));
  return createTextureFromSources(device, imgBitmaps, options);
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
export async function createTextureFromImage(device: GPUDevice, url: string, options: CreateTextureFromBitmapOptions = {}): Promise<GPUTexture> {
  return createTextureFromImages(device, [url], options);
}
