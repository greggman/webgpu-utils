import {
  generateMipmap,
  numMipLevels,
} from './generate-mipmap.js';

type CopyTextureOptions = {
  flipY?: boolean,
};

export function copySourceToTexture(
    device: GPUDevice,
    texture: GPUTexture,
    source: GPUImageCopyExternalImage['source'],
    {flipY}: CopyTextureOptions = {}) {
  device.queue.copyExternalImageToTexture(
    { source, flipY, },
    { texture },
    { width: source.width, height: source.height },
  );

  if (texture.mipLevelCount > 1) {
    generateMipmap(device, texture);
  }
}

type CreateTextureOptions = CopyTextureOptions & {
  mips?: boolean;
  usage?: GPUTextureUsageFlags,
  format?: GPUTextureFormat,
};

function getSizeFromSource(source: GPUImageCopyExternalImage['source']) {
  if (source instanceof HTMLVideoElement) {
    return [source.videoWidth, source.videoHeight];
  } else {
    return [source.width, source.height];
  }
}

export function createTextureFromSource(
    device: GPUDevice,
    source: GPUImageCopyExternalImage['source'],
    options: CreateTextureOptions = {}) {
  const size = getSizeFromSource(source);
  const texture = device.createTexture({
    format: options.format || 'rgba8unorm',
    mipLevelCount: options.mips ? numMipLevels(size) : 1,
    size,
    usage: (options.usage ?? 0) |
           GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_DST |
           GPUTextureUsage.RENDER_ATTACHMENT,
  });
  copySourceToTexture(device, texture, source, options);
  return texture;
}

type CreateTextureFromBitmapOptions = CreateTextureOptions & ImageBitmapOptions;

export async function loadImageBitmap(url: string, options: ImageBitmapOptions = {}) {
  const res = await fetch(url);
  const blob = await res.blob();
  const opt: ImageBitmapOptions = {
    ...options,
    ...(options.colorSpaceConversion !== undefined && {colorSpaceConversion: 'none'}),
  };
  return await createImageBitmap(blob, opt);
}

export async function createTextureFromImage(device: GPUDevice, url: string, options: CreateTextureFromBitmapOptions = {}) {
  const imgBitmap = await loadImageBitmap(url);
  return createTextureFromSource(device, imgBitmap, options);
}
