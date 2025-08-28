/* eslint-disable require-trailing-comma/require-trailing-comma */
import { describe, it } from '../mocha-support.js';
import {
  createTextureFromSource,
  createTextureFromSources,
  createTextureFromImage,
  copySourcesToTexture,
} from '../../dist/2.x/webgpu-utils.module.js';
import { assertArrayEqual, assertArrayEqualApproximately, assertEqual } from '../assert.js';
import { readTextureUnpadded, testWithDevice, testWithDeviceAndDocument } from '../webgpu.js';

// prevent global document
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const document = undefined;
/* global GPUBufferUsage */
/* global GPUTextureUsage */
/* global GPUMapMode */

const toVec4fFromU8 = u8 => [u8[0] / 255, u8[1] / 255, u8[2] / 255, u8[3] / 255];

function createPixelSamplingProgram(device, texture) {
  const module = device.createShaderModule({
    code: `
    @group(0) @binding(0) var tex: texture_2d<f32>;
    @group(0) @binding(1) var<uniform> lod: u32;
    @group(0) @binding(2) var<storage, read_write> result: vec4f;

    @compute @workgroup_size(1) fn cs() {
      result = textureLoad(tex, vec2u(0), lod);
    }
    `,
  });
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module },
  });
  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const storageBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const resultBuffer = device.createBuffer({
    size: storageBuffer.size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  return async function drawAndCheckColor({lod, expected, layer}) {
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView({
            dimension: '2d',
            baseArrayLayer: layer ?? 0,
            arrayLayerCount: 1,
          }),
        },
        { binding: 1, resource: { buffer: uniformBuffer } },
        { binding: 2, resource: { buffer: storageBuffer } },
      ],
    });

    device.queue.writeBuffer(uniformBuffer, 0, new Uint32Array([lod]));
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(storageBuffer, 0, resultBuffer, 0, resultBuffer.size);
    device.queue.submit([encoder.finish()]);
    await resultBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(resultBuffer.getMappedRange()).slice();
    resultBuffer.unmap();
    assertArrayEqualApproximately(result, new Float32Array(expected));
  };
}


describe('texture-utils tests', () => {

    it('creates texture from canvas with mips', testWithDeviceAndDocument(async (device, document) => {
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

      const result = await readTextureUnpadded(device, texture, 2);
      assertArrayEqualApproximately(result, [128, 0, 128, 255], 1);
    }));

    it('respects flipY', async function () {
      // TODO: Fix so this can be removed
      if (navigator.userAgent.includes('puppeteer')) {
        this.skip();
        return;
      }
      await testWithDeviceAndDocument(async (device, document) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 2;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#F00';
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = '#00F';
        ctx.fillRect(0, 1, 1, 1);

        for (let i = 0; i < 2; ++i) {
          const flipY = i === 1;
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
          const result = await readTextureUnpadded(device, texture);
          const expected = [
            [255, 0, 0, 255],
            [0, 0, 255, 255],
          ];
          const top = expected[i];
          const bottom = expected[1 - i];
          assertArrayEqual(result.subarray(0, 4), top, `flipY: ${flipY}, top`);
          assertArrayEqual(result.subarray(4, 8), bottom, `flipY: ${flipY}, bottom`);
        }
      })();
    });

    it('respects premultipliedAlpha', testWithDeviceAndDocument(async (device, document) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fillRect(0, 0, 1, 1);

      for (let i = 0; i < 2; ++i) {
        const premultipliedAlpha = i === 1;
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
        const result = await readTextureUnpadded(device, texture);
        const expected = premultipliedAlpha ? [0x80, 0, 0, 0x80] : [0xFF, 0, 0, 0x80];
        assertArrayEqualApproximately(result, expected, 1, `premultipliedAlpha: ${premultipliedAlpha}`);
      }
    }));

    it('creates 3D texture from canvases', testWithDeviceAndDocument(async (device, document) => {
      const createCanvas = color => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return canvas;
      };
      const canvases = [
        createCanvas('#f00'),
        createCanvas('#00f'),
      ];

      const texture = createTextureFromSources(
          device,
          canvases,
          {
            usage: GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.RENDER_ATTACHMENT |
                   GPUTextureUsage.COPY_DST |
                   GPUTextureUsage.COPY_SRC,
            dimension: '3d',
          }
      );

      const result = await readTextureUnpadded(device, texture, 0);
      assertArrayEqualApproximately(result, [255, 0, 0, 255, 0, 0, 255, 255], 0);
    }));

    it('can create 3D texture from canvases without COPY_SRC', testWithDeviceAndDocument(async (device, document) => {
      const createCanvas = color => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return canvas;
      };
      const canvases = [
        createCanvas('#f00'),
        createCanvas('#00f'),
      ];

      createTextureFromSources(
          device,
          canvases,
          {
            usage: GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.RENDER_ATTACHMENT |
                   GPUTextureUsage.COPY_DST,
            dimension: '3d',
          }
      );
    }));

    it('creates texture from image url with mips', testWithDevice(async device => {
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
      const result = await readTextureUnpadded(device, texture, 2);
      assertArrayEqualApproximately(result, [128, 0, 128, 255], 1);
    }));

    it('copies to layers, one layer at a time', testWithDevice(async device => {
      const testDiffTextureContent0 = [].concat([100, 101, 102], [110, 111, 112], [120, 121, 122]);
      const testDiffTextureContent1 = [].concat([200, 201, 202], [210, 211, 212], [220, 221, 222]);
      const testDiffTextureContent2 = [].concat([300, 301, 302], [310, 311, 312], [320, 321, 322]);
      const floatData = [testDiffTextureContent0, testDiffTextureContent1, testDiffTextureContent2].map(layer => new Float32Array(layer));
      const texture = device.createTexture({
        label: 'refinement test diff',
        size: [3, 3, 3],
        dimension: '2d',
        mipLevelCount: 1,
        format: 'r32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
      });

      copySourcesToTexture(device, texture, floatData);
      const result0 = await readTextureUnpadded(device, texture, 0, 0);
      const result1 = await readTextureUnpadded(device, texture, 0, 1);
      const result2 = await readTextureUnpadded(device, texture, 0, 2);
      assertArrayEqual(result0, testDiffTextureContent0, 'texture layer 0 matches expected');
      assertArrayEqual(result1, testDiffTextureContent1, 'texture layer 1 matches expected');
      assertArrayEqual(result2, testDiffTextureContent2, 'texture layer 2 matches expected');
    }));

    it('copies to layers, n layers at a time', testWithDevice(async device => {
      const testDiffTextureContent0 = [].concat([100, 101, 102], [110, 111, 112], [120, 121, 122]);
      const testDiffTextureContent1 = [].concat([200, 201, 202], [210, 211, 212], [220, 221, 222]);
      const testDiffTextureContent2 = [].concat([300, 301, 302], [310, 311, 312], [320, 321, 322]);
      const floatData = [...testDiffTextureContent0, ...testDiffTextureContent1, ...testDiffTextureContent2];
      const texture = device.createTexture({
        label: 'refinement test diff',
        size: [3, 3, 3],
        dimension: '2d',
        mipLevelCount: 1,
        format: 'r32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
      });

      copySourcesToTexture(device, texture, [floatData]);
      const result0 = await readTextureUnpadded(device, texture, 0, 0);
      const result1 = await readTextureUnpadded(device, texture, 0, 1);
      const result2 = await readTextureUnpadded(device, texture, 0, 2);
      assertArrayEqual(result0, testDiffTextureContent0, 'texture layer 0 matches expected');
      assertArrayEqual(result1, testDiffTextureContent1, 'texture layer 1 matches expected');
      assertArrayEqual(result2, testDiffTextureContent2, 'texture layer 2 matches expected');
    }));

    it('copies to layers, mips then layers at a time', testWithDevice(async device => {
      const layer0m0 = [].concat([100, 101, 102], [110, 111, 112], [120, 121, 122]);
      const layer1m0 = [].concat([200, 201, 202], [210, 211, 212], [220, 221, 222]);
      const layer2m0 = [].concat([300, 301, 302], [310, 311, 312], [320, 321, 322]);
      const layer0m1 = [1000];
      const layer1m1 = [2000];
      const layer2m1 = [3000];
      const floatData = [
        [...layer0m0, ...layer0m1],
        [...layer1m0, ...layer1m1],
        [...layer2m0, ...layer2m1],
      ];
      const texture = device.createTexture({
        label: 'refinement test diff',
        size: [3, 3, 3],
        dimension: '2d',
        mipLevelCount: 2,
        format: 'r32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
      });

      copySourcesToTexture(device, texture, floatData);
      const result0m0 = await readTextureUnpadded(device, texture, 0, 0);
      const result1m0 = await readTextureUnpadded(device, texture, 0, 1);
      const result2m0 = await readTextureUnpadded(device, texture, 0, 2);
      const result0m1 = await readTextureUnpadded(device, texture, 1, 0);
      const result1m1 = await readTextureUnpadded(device, texture, 1, 1);
      const result2m1 = await readTextureUnpadded(device, texture, 1, 2);
      assertArrayEqual(result0m0, layer0m0, 'texture layer 0 mip level 0 matches expected');
      assertArrayEqual(result1m0, layer1m0, 'texture layer 1 mip level 0 matches expected');
      assertArrayEqual(result2m0, layer2m0, 'texture layer 2 mip level 0 matches expected');
      assertArrayEqual(result0m1, layer0m1, 'texture layer 0 mip level 1 matches expected');
      assertArrayEqual(result1m1, layer1m1, 'texture layer 1 mip level 1 matches expected');
      assertArrayEqual(result2m1, layer2m1, 'texture layer 2 mip level 1 matches expected');
    }));

    it('test uploads multiple mip levels', testWithDevice(async device => {
      const r = [255,   0,   0, 255];
      const y = [255, 255,   0, 255];
      const g = [  0, 255,   0, 255];
      const b = [  0,   0, 255, 255];

      const mips = [
        [
          y, y, y, y, y, y, y, y, y, y,
          y, y, y, y, y, y, y, y, y, y,
          y, y, y, y, y, y, y, y, y, y,
          y, y, y, y, y, y, y, y, y, y,
          y, y, y, y, y, y, y, y, y, y,
          y, y, y, y, y, y, y, y, y, y,
          y, y, y, y, y, y, y, y, y, y,
        ],
        [
          r, r, r, r, r,
          r, r, r, r, r,
          r, r, r, r, r,
        ],
        [
          g, g,
        ],
        [
          b,
        ],
      ];

      const data = new Uint8Array(mips.flat(2));
      const texture = createTextureFromSource(device, data, {
        size: [10, 7],
        mipLevelCount: 4,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
      });
      const mipTexels = await Promise.all(mips.map((_, i) => readTextureUnpadded(device, texture, i, 0)));

      mipTexels.forEach((texels, i) => {
        assertArrayEqual(texels, new Uint8Array(mips[i].flat()), `mipLevel: ${i}`);
      });
    }));

    it('test uploads multiple mip levels to 3d texture', testWithDevice(async device => {
      const r = [255,   0,   0, 255];
      const y = [255, 255,   0, 255];
      const g = [  0, 255,   0, 255];

      const mips = [
        [
          y, y, y, y,
          y, y, y, y,
          y, y, y, y,
          y, y, y, y,

          y, y, y, y,
          y, y, y, y,
          y, y, y, y,
          y, y, y, y,

          y, y, y, y,
          y, y, y, y,
          y, y, y, y,
          y, y, y, y,

          y, y, y, y,
          y, y, y, y,
          y, y, y, y,
          y, y, y, y,
        ],
        [
          r, r,
          r, r,

          r, r,
          r, r,
        ],
        [
          g,
        ],
      ];

      const data = new Uint8Array(mips.flat(2));
      const texture = createTextureFromSource(device, data, {
        size: [4, 4, 4],
        mipLevelCount: 3,
        dimension: '3d',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
      });
      const mipTexels = await Promise.all(mips.map((_, i) => readTextureUnpadded(device, texture, i, 0)));

      mipTexels.forEach((texels, i) => {
        assertArrayEqual(texels, new Uint8Array(mips[i].flat()), `mipLevel: ${i}`);
      });
    }));

    it(`works with format bc7-rgba-unorm`, testWithDevice(async device => {
      if (!device.features.has('texture-compression-bc')) {
        this.skip();
        return;
      }
      const green = toVec4fFromU8([2, 255, 2, 255]);
      const format = 'bc7-rgba-unorm';
      const green_4x4 = new Uint8Array([32, 128, 193, 255, 15, 24, 252, 255, 175, 170, 170, 170, 0, 0, 0, 0]);
      const size = [4, 4];

      // eslint-disable-next-line no-unused-vars
      const texture = createTextureFromSource(device, green_4x4, {
        size,
        format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
      });

      const drawAndCheckColor = createPixelSamplingProgram(device, texture);
      await drawAndCheckColor({ lod: 0, expected: green });
    }));

    it(`works with format bc1-rgb-unorm`, testWithDevice(async device => {
      if (!device.features.has('texture-compression-bc')) {
        this.skip();
        return;
      }

      const red = toVec4fFromU8([255, 0, 0, 255]);
      const format = 'bc1-rgba-unorm';
      const red_4x4 = new Uint16Array([
        0b11111_000000_00000,
        0b11111_000000_00000,
        0, 0,
      ]);
      const size = [4, 4];

      const texture = createTextureFromSource(device, red_4x4, {
        size,
        format,
      });
      const drawAndCheckColor = createPixelSamplingProgram(device, texture);
      await drawAndCheckColor({ lod: 0, expected: red });
    }));

    it(`works with mips with format bc1-rgba-unorm`, testWithDevice(async device => {
      const format = 'bc1-rgba-unorm';
      const red_4x4 = [
        0b11111_000000_00000,
        0b11111_000000_00000,
        0, 0,
      ];
      const yellow_4x4 = [
        0b11111_111111_00000,
        0b11111_111111_00000,
        0, 0,
      ];
      const green_4x4 = [
        0b00000_111111_00000,
        0b00000_111111_00000,
        0, 0,
      ];
      const blue_4x4 = [
        0b00000_000000_11111,
        0b00000_000000_11111,
        0, 0,
      ];
      const data = new Uint16Array([
        ...red_4x4, ...red_4x4, ...red_4x4, // 12x8
        ...red_4x4, ...red_4x4, ...red_4x4,
        ...green_4x4, ...green_4x4, // 6x4
        ...blue_4x4, // 3x2
        ...yellow_4x4, // 1x1
      ]);

      const size = [12, 8];

      const r = [255,   0,   0, 255];
      const y = [255, 255,   0, 255];
      const g = [  0, 255,   0, 255];
      const b = [  0,   0, 255, 255];

      const texture = createTextureFromSource(device, data, {
        size,
        format,
        mipLevelCount: 4,
      });
      const drawAndCheckColor = createPixelSamplingProgram(device, texture);
      const tests = [
        { lod: 0, expected: toVec4fFromU8(r) },
        { lod: 1, expected: toVec4fFromU8(g) },
        { lod: 2, expected: toVec4fFromU8(b) },
        { lod: 3, expected: toVec4fFromU8(y) },
      ];
      for (const {lod, expected} of tests) {
        await drawAndCheckColor({ lod, expected });
      }
    }));

    it(`works with mips with format bc1-rgba-unorm cubemap`, testWithDevice(async device => {
      const format = 'bc1-rgba-unorm';
      const red565 = 0b11111_000000_00000;
      const yellow565 = 0b11111_111111_00000;
      const green565 = 0b0000_111111_00000;
      const cyan565 = 0b0000_111111_11111;
      const blue565 = 0b00000_000000_11111;
      const magenta565 = 0b11111_000000_11111;
      const cubeMapData = new Uint16Array([
         ...[red565, red565, 0, 0],
         ...[yellow565, yellow565, 0, 0],
         ...[green565, green565, 0, 0],
         ...[cyan565, cyan565, 0, 0],
         ...[blue565, blue565, 0, 0],
         ...[magenta565, magenta565, 0, 0],
      ]);
      const size = [4, 4, 6];
      const texture = createTextureFromSource(device, cubeMapData, {
        size,
        format,
      });

      const drawAndCheckColor = createPixelSamplingProgram(device, texture);
      const tests = [
        { layer: 0, expected: [1, 0, 0, 1] },
        { layer: 1, expected: [1, 1, 0, 1] },
        { layer: 2, expected: [0, 1, 0, 1] },
        { layer: 3, expected: [0, 1, 1, 1] },
        { layer: 4, expected: [0, 0, 1, 1] },
        { layer: 5, expected: [1, 0, 1, 1] },
      ];
      for (const {layer, expected} of tests) {
        await drawAndCheckColor({ layer, expected });
      }
    }));

    [
      {
        desc: 'typedArray',
        convertDataFn: ({data, TypedArrayType = Uint8Array}) => {
          if (Array.isArray(data)) {
            return new TypedArrayType(data);
          } else {
            return {
              ...data,
              data: new TypedArrayType(data.data),
            };
          }
        },
      },
      {
        desc: 'native array',
        convertDataFn: ({data}) => data,
      }
    ].forEach(({desc, convertDataFn}) => {
      describe(`creates texture from ${desc}`, () => {
        const r = [255, 0, 0, 255];
        const g = [0, 255, 0, 255];
        const b = [0, 0, 255, 255];
        const y = [255, 255, 0, 255];
        const tests = [
          {
            desc: 'square (because sqrt is int and no width or height provided)',
            data: [
              r, g,
              b, y,
            ].flat(),
            expected: {
              width: 2,
              height: 2,
              mipLevelCount: 2,
              format: 'rgba8unorm',
            },
          },
          {
            desc: 'Nx1 (because sqrt is not a int and no width or height provided)',
            data: [
              r, g, b,
            ].flat(),
            expected: {
              width: 3,
              height: 1,
              mipLevelCount: 2,
              format: 'rgba8unorm',
            },
          },
          {
            desc: '4x2 (because 8 elements and width of 2)',
            data: {
              width: 4,
              data: [
                r, r, r, r,
                b, b, b, b,
              ].flat(),
            },
            expected: {
              width: 4,
              height: 2,
              mipLevelCount: 3,
              format: 'rgba8unorm',
            },
          },
          {
            desc: '2x4 (because 8 elements and height of 2)',
            data: {
              height: 4,
              data: [
                r, r, r, r,
                b, b, b, b,
              ].flat(),
            },
            expected: {
              width: 2,
              height: 4,
              mipLevelCount: 3,
              format: 'rgba8unorm',
            },
          },
          {
            desc: '2x2x4 (because 16 elements and width and height of 2)',
            data: {
              width: 2,
              height: 2,
              data: [
                r, r, r, r,
                b, b, b, b,
                g, g, g, g,
                y, y, y, y,
              ].flat(),
            },
            options: {
              mips: false,
            },
            expected: {
              width: 2,
              height: 2,
              depthOrArrayLayers: 4,
              mipLevelCount: 1,
              format: 'rgba8unorm',
            },
          },
          {
            desc: 'square rgba16float',
            data: {
              data: [
                r, g,
                b, y,
              ].flat(),
            },
            TypedArrayType: Uint16Array,
            options: {
              format: 'rgba16float'
            },
            expected: {
              width: 2,
              height: 2,
              mipLevelCount: 2,
              format: 'rgba16float',
            },
          },
          {
            desc: 'square rg16float',
            data: {
              data: [
                r, g,
                b, y,
              ].map(v => v.slice(0, 2)).flat(),
            },
            TypedArrayType: Uint16Array,
            options: {
              format: 'rg16float'
            },
            expected: {
              width: 2,
              height: 2,
              mipLevelCount: 2,
              format: 'rg16float',
            },
          },
          /*
          {
            for data, Image {
              desc: '3d',
              desc: '2d-array',
              desc: 'cube-map',
              desc: 'from image
          }
          */
        ];

        for (const test of tests) {
          const { desc, expected, options } = test;
          it(desc, testWithDevice(async device => {
            const texture = createTextureFromSource(device, convertDataFn(test), {mips: true, ...options});
            assertEqual(texture.width, expected.width);
            assertEqual(texture.height, expected.height);
            assertEqual(texture.depthOrArrayLayers, expected.depthOrArrayLayers || 1);
            assertEqual(texture.mipLevelCount, expected.mipLevelCount);
            assertEqual(texture.format, expected.format);
          }));
        }
      });
    });
 });

