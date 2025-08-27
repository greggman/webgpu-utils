import { TypedArrayConstructor } from "./typed-arrays.js";

// [blockWidth, blockHeight, bytesPerBlock, units per TypedArray element, TypedArrayConstructor]
const kFormatInfo = {
  'rgba8unorm-srgb': [1, 1, 4, 4, Uint8Array],
  'bgra8unorm-srgb': [1, 1, 4, 4, Uint8Array],
  'rgb10a2uint': [1, 1, 4, 1, Uint32Array],
  'rgb10a2unorm': [1, 1, 4, 1, Uint32Array],
  'rg11b10ufloat': [1, 1, 4, 1, Uint32Array],
  'rgb9e5ufloat': [1, 1, 4, 1, Uint32Array],
  'stencil8': [1, 1, 1, 1, Uint8Array],
  'depth16unorm': [1, 1, 2, 1, Uint16Array],
  'depth32float': [1, 1, 4, 1, Float32Array],
  'depth24plus-stencil8': [],
  'depth32float-stencil8': [],
  'bc1-rgba-unorm': [4, 4, 8],
  'bc1-rgba-unorm-srgb': [4, 4, 8],
  'bc2-rgba-unorm': [4, 4, 16],
  'bc2-rgba-unorm-srgb': [4, 4, 16],
  'bc3-rgba-unorm': [4, 4, 16],
  'bc3-rgba-unorm-srgb': [4, 4, 16],
  'bc4-r-unorm': [4, 4, 8],
  'bc4-r-snorm': [4, 4, 8],
  'bc5-rg-unorm': [4, 4, 16],
  'bc5-rg-snorm': [4, 4, 16],
  'bc6h-rgb-ufloat': [4, 4, 16],
  'bc6h-rgb-float': [4, 4, 16],
  'bc7-rgba-unorm': [4, 4, 16],
  'bc7-rgba-unorm-srgb': [4, 4, 16],
  'etc2-rgb8unorm': [4, 4, 8],
  'etc2-rgb8unorm-srgb': [4, 4, 8],
  'etc2-rgb8a1unorm': [4, 4, 8],
  'etc2-rgb8a1unorm-srgb': [4, 4, 8],
  'etc2-rgba8unorm': [4, 4, 16],
  'etc2-rgba8unorm-srgb': [4, 4, 16],
  'eac-r11unorm': [4, 4, 8],
  'eac-r11snorm': [4, 4, 8],
  'eac-rg11unorm': [4, 4, 16],
  'eac-rg11snorm': [4, 4, 16],
  'astc-4x4-unorm': [4, 4, 16],
  'astc-4x4-unorm-srgb': [4, 4, 16],
  'astc-5x4-unorm': [5, 4, 16],
  'astc-5x4-unorm-srgb': [5, 4, 16],
  'astc-5x5-unorm': [5, 5, 16],
  'astc-5x5-unorm-srgb': [5, 5, 16],
  'astc-6x5-unorm': [6, 5, 16],
  'astc-6x5-unorm-srgb': [6, 5, 16],
  'astc-6x6-unorm': [6, 6, 16],
  'astc-6x6-unorm-srgb': [6, 6, 16],
  'astc-8x5-unorm': [8, 5, 16],
  'astc-8x5-unorm-srgb': [8, 5, 16],
  'astc-8x6-unorm': [8, 6, 16],
  'astc-8x6-unorm-srgb': [8, 6, 16],
  'astc-8x8-unorm': [8, 8, 16],
  'astc-8x8-unorm-srgb': [8, 8, 16],
  'astc-10x5-unorm': [10, 5, 16],
  'astc-10x5-unorm-srgb': [10, 5, 16],
  'astc-10x6-unorm': [10, 6, 16],
  'astc-10x6-unorm-srgb': [10, 6, 16],
  'astc-10x8-unorm': [10, 8, 16],
  'astc-10x8-unorm-srgb': [10, 8, 16],
  'astc-10x10-unorm': [10, 10, 16],
  'astc-10x10-unorm-srgb': [10, 10, 16],
  'astc-12x10-unorm': [12, 10, 16],
  'astc-12x10-unorm-srgb': [12, 10, 16],
  'astc-12x12-unorm': [12, 12, 16],
  'astc-12x12-unorm-srgb': [12, 12, 16],
} as const;

const kFormatToTypedArray: {[key: string]: TypedArrayConstructor} = {
  '8snorm': Int8Array,
  '8unorm': Uint8Array,
  '8sint': Int8Array,
  '8uint': Uint8Array,
  '16snorm': Int16Array,
  '16unorm': Uint16Array,
  '16sint': Int16Array,
  '16uint': Uint16Array,
  '32snorm': Int32Array,
  '32unorm': Uint32Array,
  '32sint': Int32Array,
  '32uint': Uint32Array,
  '16float': Float16Array,
  '32float': Float32Array,
} as const;

const kTextureFormatRE = /([a-z]+)(\d+)([a-z]+)/;

export type FormatInfo = {
  blockWidth: number,
  blockHeight: number,
  bytesPerBlock: number,
  unitsPerElement: number,
  Type: TypedArrayConstructor
};

export function getTextureFormatInfo(format: GPUTextureFormat): FormatInfo {
  const info = kFormatInfo[format as keyof typeof kFormatInfo];
  if (info) {
    const [blockWidth, blockHeight, bytesPerBlock, unitsPerElement = 1, Type = Uint8Array] = info;
    if (bytesPerBlock === undefined) {
      throw new Error(`Format ${format} is not supported`);
    }
    return {
      blockWidth,
      blockHeight,
      bytesPerBlock,
      unitsPerElement,
      Type,
    };
  }

  // this is a hack! It will only work for common formats
  const [, channels, bits, typeName] = kTextureFormatRE.exec(format)!;
  // TODO: if the regex fails, use table for other formats?
  const numChannels = channels.length;
  const bytesPerChannel = parseInt(bits) / 8;
  const bytesPerBlock = numChannels * bytesPerChannel;
  const Type = kFormatToTypedArray[`${bits}${typeName}`] ?? Uint8Array;

  return {
    blockWidth: 1,
    blockHeight: 1,
    bytesPerBlock,
    unitsPerElement: 1,
    Type,
  };
}
