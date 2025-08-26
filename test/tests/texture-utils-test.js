/* eslint-disable require-trailing-comma/require-trailing-comma */
import { describe, it } from '../mocha-support.js';
import {
  createTextureFromSource,
  createTextureFromSources,
  createTextureFromImage,
  copySourcesToTexture,
} from '../../dist/1.x/webgpu-utils.module.js';
import { assertArrayEqual, assertArrayEqualApproximately, assertEqual } from '../assert.js';
import { readTextureUnpadded, testWithDevice, testWithDeviceAndDocument } from '../webgpu.js';

// prevent global document
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const document = undefined;
/* global GPUBufferUsage */
/* global GPUTextureUsage */

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

