import { describe, it } from '../mocha-support.js';
import {
  generateMipmap,
  numMipLevels,
} from '../../dist/0.x/webgpu-utils.module.js';
import { assertArrayEqual, assertArrayEqualApproximately, assertEqual, assertFalsy, assertTruthy } from '../assert.js';
import { testWithDevice } from '../webgpu.js';

describe('generate-mipmap tests', () => {

    it('returns correct number of mip levels', () => {
      assertEqual(numMipLevels([1]), 1);
      assertEqual(numMipLevels([2]), 2);
      assertEqual(numMipLevels([3]), 2);
      assertEqual(numMipLevels([4]), 3);
      assertEqual(numMipLevels([4]), 3);

      assertEqual(numMipLevels([1, 1]), 1);
      assertEqual(numMipLevels([1, 2]), 2);
      assertEqual(numMipLevels([1, 3]), 2);
      assertEqual(numMipLevels([1, 4]), 3);
      assertEqual(numMipLevels([1, 4]), 3);

      assertEqual(numMipLevels([1, 1, 1]), 1);
      assertEqual(numMipLevels([1, 1, 2]), 2);
      assertEqual(numMipLevels([1, 1, 3]), 2);
      assertEqual(numMipLevels([1, 1, 4]), 3);
      assertEqual(numMipLevels([1, 1, 4]), 3);

      assertEqual(numMipLevels({width: 1}), 1);
      assertEqual(numMipLevels({width: 2}), 2);
      assertEqual(numMipLevels({width: 3}), 2);
      assertEqual(numMipLevels({width: 4}), 3);
      assertEqual(numMipLevels({width: 4}), 3);

      assertEqual(numMipLevels({width: 1, height: 1}), 1);
      assertEqual(numMipLevels({width: 1, height: 2}), 2);
      assertEqual(numMipLevels({width: 1, height: 3}), 2);
      assertEqual(numMipLevels({width: 1, height: 4}), 3);
      assertEqual(numMipLevels({width: 1, height: 4}), 3);

      assertEqual(numMipLevels({width: 1, depthOrArrayLayers: 1}), 1);
      assertEqual(numMipLevels({width: 1, depthOrArrayLayers: 2}), 2);
      assertEqual(numMipLevels({width: 1, depthOrArrayLayers: 3}), 2);
      assertEqual(numMipLevels({width: 1, depthOrArrayLayers: 4}), 3);
      assertEqual(numMipLevels({width: 1, depthOrArrayLayers: 4}), 3);

    });

    it('generates mipmaps', () => testWithDevice(async device => {
      const kTextureWidth = 4;
      const kTextureHeight = 4;
      const r = [255, 0, 0, 255];
      const b = [0, 0, 255, 255];
      const textureData = new Uint8Array([
        r, r, b, b,
        r, r, b, b,
        b, b, r, r,
        b, b, r, r,
      ].flat());

      const size = [kTextureWidth, kTextureHeight];
      const texture = device.createTexture({
        size,
        mipLevelCount: numMipLevels(size),
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING |
               GPUTextureUsage.RENDER_ATTACHMENT |
               GPUTextureUsage.COPY_DST |
               GPUTextureUsage.COPY_SRC,
      });

      device.queue.writeTexture(
          { texture },
          textureData,
          { bytesPerRow: kTextureWidth * 4 },
          { width: kTextureWidth, height: kTextureHeight },
      );
      generateMipmap(device, texture);

      const buffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer(
        { texture, mipLevel: 2 },
        { buffer, },
        [1, 1],
      );
      device.queue.submit([encoder.finish()]);

      await buffer.mapAsync(GPUMapMode.READ);
      const result = new Uint8Array(buffer.getMappedRange());
      assertArrayEqualApproximately(result, [128, 0, 128, 255], 1);
    }));
 });

