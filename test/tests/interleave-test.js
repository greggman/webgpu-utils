import { describe, it } from '../mocha-support.js';
import {
    createBufferInfoFromArrays,
} from '../../dist/0.x/webgpu-utils.module.js';
import { assertArrayEqual, assertEqual, assertDeepEqual, assertTruthy } from '../assert.js';
import { testWithDevice, readBuffer } from '../webgpu.js';

function assertInterleaveEquals(actual, expected, offset, numComponents, stride) {
  for (let off = offset; off < actual.length; off += stride) {
    const expectedOff = Math.floor(off / stride) * numComponents; 
    const a = actual.slice(off, off + numComponents);
    const e = expected.slice(expectedOff, expectedOff + numComponents);
    assertArrayEqual(a, e, `actual at ${off}, expected at ${expectedOff}`);
  }
}

describe('interleave-tests', () => {

  it('interleaves - simple native arrays', () => testWithDevice(async device => {
    const r = [1, 0, 0, 1];
    const y = [1, 1, 0, 1];
    const g = [0, 1, 0, 1];
    const c = [0, 1, 1, 1];
    const b = [0, 0, 1, 1];
    const m = [1, 0, 1, 1];
    const arrays = {
      position: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
      normal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
      texcoord: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
      color: [
        r, r, r, r,
        y, y, y, y,
        g, g, g, g,
        c, c, c, c,
        b, b, b, b,
        m, m, m, m,
      ].flat(),
      indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
    };
    const bufferInfo = createBufferInfoFromArrays(device, arrays, {
      usage: GPUBufferUsage.COPY_SRC
    });

    const f32Stride = 3 + 3 + 2 + 4;

    assertEqual(bufferInfo.numElements, 36);
    assertTruthy(bufferInfo.indexBuffer instanceof GPUBuffer);
    assertEqual(bufferInfo.indexBuffer.size, 36 * 4);
    assertEqual(bufferInfo.indexBuffer.usage, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_SRC);
    assertEqual(bufferInfo.indexFormat, 'uint32');
    assertEqual(bufferInfo.buffer.size, 24 * f32Stride * 4);
    assertEqual(bufferInfo.buffer.usage, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC);
    assertDeepEqual(bufferInfo.bufferLayout, {
      stepMode: 'vertex',
      arrayStride: f32Stride * 4,
      attributes: [
        { shaderLocation: 0, offset:  0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
        { shaderLocation: 2, offset: 24, format: 'float32x2' },
        { shaderLocation: 3, offset: 32, format: 'float32x4' },
      ],
    });

    // TODO: buffers?
    {
      const u8 = await readBuffer(device, bufferInfo.buffer);
      const f32 = new Float32Array(u8.buffer);

      assertInterleaveEquals(f32, arrays.position, 0, 3, f32Stride);
      assertInterleaveEquals(f32, arrays.normal, 3, 3, f32Stride);
      assertInterleaveEquals(f32, arrays.texcoord, 6, 2, f32Stride);
      assertInterleaveEquals(f32, arrays.color, 8, 4, f32Stride);
    }
  }));

  it('interleaves - simple typed arrays', () => testWithDevice(async device => {
    const r = [255,   0,   0, 255];
    const y = [255, 255,   0, 255];
    const g = [  0, 255,   0, 255];
    const c = [  0, 255, 255, 255];
    const b = [  0,   0, 255, 255];
    const m = [255,   0, 255, 255];
    const arrays = {
      position: new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]),
      normal: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
      texcoord: new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]),
      color: new Uint8Array([
        r, r, r, r,
        y, y, y, y,
        g, g, g, g,
        c, c, c, c,
        b, b, b, b,
        m, m, m, m,
      ].flat()),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]),
    };
    const bufferInfo = createBufferInfoFromArrays(device, arrays, {
      usage: GPUBufferUsage.COPY_SRC
    });

    const f32Stride = 3 + 3 + 2 + 1;

    assertEqual(bufferInfo.numElements, 36);
    assertTruthy(bufferInfo.indexBuffer instanceof GPUBuffer);
    assertEqual(bufferInfo.indexBuffer.size, 36 * 2);
    assertEqual(bufferInfo.indexBuffer.usage, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_SRC);
    assertEqual(bufferInfo.indexFormat, 'uint16');
    assertEqual(bufferInfo.buffer.size, 24 * f32Stride * 4);
    assertEqual(bufferInfo.buffer.usage, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC);
    assertDeepEqual(bufferInfo.bufferLayout, {
      stepMode: 'vertex',
      arrayStride: f32Stride * 4,
      attributes: [
        { shaderLocation: 0, offset:  0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
        { shaderLocation: 2, offset: 24, format: 'float32x2' },
        { shaderLocation: 3, offset: 32, format: 'unorm8x4' },
      ],
    });

    // TODO: buffers?
    {
      const u8 = await readBuffer(device, bufferInfo.buffer);
      const f32 = new Float32Array(u8.buffer);

      assertInterleaveEquals(f32, arrays.position, 0, 3, f32Stride);
      assertInterleaveEquals(f32, arrays.normal, 3, 3, f32Stride);
      assertInterleaveEquals(f32, arrays.texcoord, 6, 2, f32Stride);
      assertInterleaveEquals(u8, arrays.color, 8 * 4, 4, f32Stride * 4);
    }
  }));

  it('interleaves - full typed arrays', () => testWithDevice(async device => {
    const r = [255,   0,   0, 255];
    const y = [255, 255,   0, 255];
    const g = [  0, 255,   0, 255];
    const c = [  0, 255, 255, 255];
    const b = [  0,   0, 255, 255];
    const m = [255,   0, 255, 255];
    const arrays = {
      position: {
        data: new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]),
      },
      normal: {
        data: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
      },
      texcoord: {
        data: new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]),
      },
      color: {
        data: new Uint8Array([
          r, r, r, r,
          y, y, y, y,
          g, g, g, g,
          c, c, c, c,
          b, b, b, b,
          m, m, m, m,
        ].flat()),
      },
      other: {
        data: new Uint32Array([
          11, 11, 11, 11,
          22, 22, 22, 22,
          33, 33, 33, 33,
          44, 44, 44, 44,
          55, 55, 55, 55,
          66, 66, 66, 66,
        ]),
        numComponents: 1,
      },
      indices: new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]),
    };
    const bufferInfo = createBufferInfoFromArrays(device, arrays, {
      usage: GPUBufferUsage.COPY_SRC
    });

    const f32Stride = 3 + 3 + 2 + 1 + 1;

    assertEqual(bufferInfo.numElements, 36);
    assertTruthy(bufferInfo.indexBuffer instanceof GPUBuffer);
    assertEqual(bufferInfo.indexBuffer.size, 36 * 2);
    assertEqual(bufferInfo.indexBuffer.usage, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_SRC);
    assertEqual(bufferInfo.indexFormat, 'uint16');
    assertEqual(bufferInfo.buffer.size, 24 * f32Stride * 4);
    assertEqual(bufferInfo.buffer.usage, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC);
    assertDeepEqual(bufferInfo.bufferLayout, {
      stepMode: 'vertex',
      arrayStride: f32Stride * 4,
      attributes: [
        { shaderLocation: 0, offset:  0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
        { shaderLocation: 2, offset: 24, format: 'float32x2' },
        { shaderLocation: 3, offset: 32, format: 'unorm8x4' },
        { shaderLocation: 4, offset: 36, format: 'uint32' },
      ],
    });

    // TODO: buffers?
    {
      const u8 = await readBuffer(device, bufferInfo.buffer);
      const f32 = new Float32Array(u8.buffer);
      const u32 = new Uint32Array(u8.buffer);

      assertInterleaveEquals(f32, arrays.position.data, 0, 3, f32Stride);
      assertInterleaveEquals(f32, arrays.normal.data, 3, 3, f32Stride);
      assertInterleaveEquals(f32, arrays.texcoord.data, 6, 2, f32Stride);
      assertInterleaveEquals(u8, arrays.color.data, 8 * 4, 4, f32Stride * 4);
      assertInterleaveEquals(u32, arrays.other.data, 9, 1, f32Stride);
    }
  }));

  // TODO: test interleave
  // TODO: test stepMode
  // TODO: test passing in type works
  // TODO: test non-interleaved? (should this be offset?)
  // TODO: test non-normalized
  // TODO: test uint8x3 fails
  // TODO: test shaderLocations as array? (do I care about this feature?)

});