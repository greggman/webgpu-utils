import { describe, it } from '../mocha-support.js';
import {
  createTextureFromSource,
  createTextureFromImage,
} from '../../dist/0.x/webgpu-utils.module.js';
import { assertArrayEqual, assertArrayEqualApproximately } from '../assert.js';
import { testWithDeviceAndDocument } from '../webgpu.js';

const roundUp = (v, r) => Math.ceil(v / r) * r;
const mipSize = (size, mipLevel) => size.map(v => Math.floor(v / 2 ** mipLevel));

// assumes rgba8unorm
async function readTexture(device, texture, mipLevel = 0) {
  const size = mipSize([texture.width, texture.height], mipLevel)
  const bytesPerRow = roundUp(size[0] * 4, 256);
  const buffer = device.createBuffer({
    size: bytesPerRow * size[1],
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer(
    { texture, mipLevel },
    { buffer, bytesPerRow },
    size,
  );
  device.queue.submit([encoder.finish()]);

  await buffer.mapAsync(GPUMapMode.READ);
  // Get a copy of the result because on unmap the view dies.
  const result = new Uint8Array(buffer.getMappedRange()).slice();
  buffer.unmap();
  buffer.destroy();
  return result;
}

describe('texture-utils tests', () => {

    it('creates texture from canvas with mips', () => testWithDeviceAndDocument(async device => {
      const canvas = document.createElement('canvas');
      canvas.width = 4;
      canvas.height = 4;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F00';
      ctx.fillRect(0, 0, 4, 4);
      ctx.fillStyle = '#00F';
      ctx.fillRect(0, 0, 2, 2);
      ctx.fillRect(2, 2, 2, 2);

      const texture = createTextureFromSource(
          device,
          canvas,
          {
            usage: GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.RENDER_ATTACHMENT |
                   GPUTextureUsage.COPY_DST |
                   GPUTextureUsage.COPY_SRC,
            mips: true,
          }
      );

      const result = await readTexture(device, texture, 2);
      assertArrayEqualApproximately(result.subarray(0, 4), [128, 0, 128, 255], 1);
    }));

    it('respects flipY', () => testWithDeviceAndDocument(async device => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F00';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = '#00F';
      ctx.fillRect(0, 1, 1, 1);

      for (let i = 0; i < 2; ++i) {
        const flipY = i == 1;
        const texture = createTextureFromSource(
            device,
            canvas,
            {
              usage: GPUTextureUsage.TEXTURE_BINDING |
                     GPUTextureUsage.RENDER_ATTACHMENT |
                     GPUTextureUsage.COPY_DST |
                     GPUTextureUsage.COPY_SRC,
              flipY,
            }
        );
        const result = await readTexture(device, texture);
        const expected = [
          [255, 0, 0, 255],
          [0, 0, 255, 255],
        ];
        const top = expected[i];
        const bottom = expected[1 - i];
        assertArrayEqual(result.subarray(0, 4), top, `flipY: ${flipY}, top`);
        assertArrayEqual(result.subarray(256, 256 + 4), bottom, `flipY: ${flipY}, bottom`);
      }
    }));

    it('respects premultipliedAlpha', () => testWithDeviceAndDocument(async device => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fillRect(0, 0, 1, 1);

      for (let i = 0; i < 2; ++i) {
        const premultipliedAlpha = i == 1;
        const texture = createTextureFromSource(
            device,
            canvas,
            {
              usage: GPUTextureUsage.TEXTURE_BINDING |
                     GPUTextureUsage.RENDER_ATTACHMENT |
                     GPUTextureUsage.COPY_DST |
                     GPUTextureUsage.COPY_SRC,
              premultipliedAlpha,
            }
        );
        const result = await readTexture(device, texture);
        const expected = premultipliedAlpha ? [0x80, 0, 0, 0x80] : [0xFF, 0, 0, 0x80];
        assertArrayEqualApproximately(result.subarray(0, 4), expected, 1, `premultipliedAlpha: ${premultipliedAlpha}`);
      }
    }));

    it('creates texture from image url with mips', () => testWithDeviceAndDocument(async device => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACJJREFUGFddibENAAAMgvD/o2l07AIJBBRAUpUv2LkzkR8OvcEL/bJgfmEAAAAASUVORK5CYII=';
      const texture = await createTextureFromImage(
          device,
          dataUrl,
          {
            usage: GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.RENDER_ATTACHMENT |
                   GPUTextureUsage.COPY_DST |
                   GPUTextureUsage.COPY_SRC,
            mips: true,
          }
      );
      const result = await readTexture(device, texture, 2);
      assertArrayEqualApproximately(result.subarray(0, 4), [128, 0, 128, 255], 1);
    }));

 });

