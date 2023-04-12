import { describe, it } from '../mocha-support.js';
import {
  createTextureFromSource,
} from '../../dist/0.x/webgpu-utils.module.js';
import { assertArrayEqualApproximately } from '../assert.js';

describe('texture-utils tests', () => {

    it('creates texture from canvas with mips', async function() {
      const adapter = await globalThis?.navigator?.gpu?.requestAdapter();
      const device = await adapter?.requestDevice();
      if (!device || typeof document === 'undefined') {
        this.skip();
        return;
      }

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

      texture.destroy();
      buffer.destroy();
      device.destroy();
    });
 });

