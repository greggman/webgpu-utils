import {
  isTypedArray,
} from './typed-arrays.js';

export function guessTextureBindingViewDimensionForTexture(
    dimension: GPUTextureDimension | undefined,
    depthOrArrayLayers: number,
): GPUTextureViewDimension {
  switch (dimension) {
    case '1d': return '1d';
    case '3d': return '3d';
    default: return depthOrArrayLayers > 1 ? '2d-array' : '2d';
  }
}

function normalizeGPUExtent3Dict(size: GPUExtent3DDict) {
  return [size.width, size.height || 1, size.depthOrArrayLayers || 1];
}

/**
 * Converts a `GPUExtent3D` into an array of numbers
 *
 * `GPUExtent3D` has two forms `[width, height?, depth?]` or
 * `{width: number, height?: number, depthOrArrayLayers?: number}`
 *
 * You pass one of those in here and it returns an array of 3 numbers
 * so that your code doesn't have to deal with multiple forms.
 *
 * @param size
 * @returns an array of 3 numbers, [width, height, depthOrArrayLayers]
 */
export function normalizeGPUExtent3D(size: GPUExtent3D): number[] {
  return (Array.isArray(size) || isTypedArray(size))
    ? [...(size as Iterable<number>), 1, 1].slice(0, 3)
    : normalizeGPUExtent3Dict(size as GPUExtent3DDict);
}

/**
 * Given a GPUExtent3D returns the number of mip levels needed
 *
 * @param size
 * @returns number of mip levels needed for the given size
 */
export function numMipLevels(size: GPUExtent3D, dimension?: GPUTextureDimension): number {
   const sizes = normalizeGPUExtent3D(size);
   const maxSize = Math.max(...sizes.slice(0, dimension === '3d' ? 3 : 2));
   return 1 + Math.log2(maxSize) | 0;
}

// Use a WeakMap so the device can be destroyed and/or lost
const byDevice = new WeakMap();

/**
 * Generates mip levels from level 0 to the last mip for an existing texture
 *
 * The texture must have been created with TEXTURE_BINDING and RENDER_ATTACHMENT
 * and been created with mip levels
 *
 * @param device A GPUDevice
 * @param texture The texture to create mips for
 * @param textureBindingViewDimension This is only needed in compatibility mode
 *   and it is only needed when the texture is going to be used as a cube map.
 */
export function generateMipmap(
    device: GPUDevice,
    texture: GPUTexture,
    textureBindingViewDimension?: GPUTextureViewDimension) {
  let perDeviceInfo = byDevice.get(device);
  if (!perDeviceInfo) {
    perDeviceInfo = {
      pipelineByFormatAndViewDimension: {},
      moduleByViewDimension: {},
    };
    byDevice.set(device, perDeviceInfo);
  }
  let {
    sampler,
    module,
  } = perDeviceInfo;
  const {
    pipelineByFormatAndViewDimension,
  } = perDeviceInfo;
  textureBindingViewDimension = device.features.has('core-features-and-limits')
    ? '2d-array'
    : textureBindingViewDimension ?? guessTextureBindingViewDimensionForTexture(
        texture.dimension, texture.depthOrArrayLayers
      );
  if (!module) {
    module = device.createShaderModule({
      label: `mip level generation for ${textureBindingViewDimension}`,
      code: `
        const faceMat = array(
          mat3x3f( 0,  0,  -2,  0, -2,   0,  1,  1,   1),   // pos-x
          mat3x3f( 0,  0,   2,  0, -2,   0, -1,  1,  -1),   // neg-x
          mat3x3f( 2,  0,   0,  0,  0,   2, -1,  1,  -1),   // pos-y
          mat3x3f( 2,  0,   0,  0,  0,  -2, -1, -1,   1),   // neg-y
          mat3x3f( 2,  0,   0,  0, -2,   0, -1,  1,   1),   // pos-z
          mat3x3f(-2,  0,   0,  0, -2,   0,  1,  1,  -1));  // neg-z

        struct VSOutput {
          @builtin(position) position: vec4f,
          @location(0) texcoord: vec2f,
          @location(1) @interpolate(flat, either) baseArrayLayer: u32,
        };

        @vertex fn vs(
          @builtin(vertex_index) vertexIndex : u32,
          @builtin(instance_index) baseArrayLayer: u32,
        ) -> VSOutput {
          var pos = array<vec2f, 3>(
            vec2f(-1.0, -1.0),
            vec2f(-1.0,  3.0),
            vec2f( 3.0, -1.0),
          );

          var vsOutput: VSOutput;
          let xy = pos[vertexIndex];
          vsOutput.position = vec4f(xy, 0.0, 1.0);
          vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
          vsOutput.baseArrayLayer = baseArrayLayer;
          return vsOutput;
        }

        @group(0) @binding(0) var ourSampler: sampler;

        @group(0) @binding(1) var ourTexture2d: texture_2d<f32>;
        @fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
          return textureSample(ourTexture2d, ourSampler, fsInput.texcoord);
        }

        @group(0) @binding(1) var ourTexture2dArray: texture_2d_array<f32>;
        @fragment fn fs2darray(fsInput: VSOutput) -> @location(0) vec4f {
          return textureSample(
            ourTexture2dArray,
            ourSampler,
            fsInput.texcoord,
            fsInput.baseArrayLayer);
        }

        @group(0) @binding(1) var ourTextureCube: texture_cube<f32>;
        @fragment fn fscube(fsInput: VSOutput) -> @location(0) vec4f {
          return textureSample(
            ourTextureCube,
            ourSampler,
            faceMat[fsInput.baseArrayLayer] * vec3f(fract(fsInput.texcoord), 1));
        }

        @group(0) @binding(1) var ourTextureCubeArray: texture_cube_array<f32>;
        @fragment fn fscubearray(fsInput: VSOutput) -> @location(0) vec4f {
          return textureSample(
            ourTextureCubeArray,
            ourSampler,
            faceMat[fsInput.baseArrayLayer] * vec3f(fract(fsInput.texcoord), 1), fsInput.baseArrayLayer);
        }
      `,
    });

    sampler = device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
    });
    Object.assign(perDeviceInfo, { sampler, module });
  }

  const id = `${texture.format}.${textureBindingViewDimension}`;

  if (!pipelineByFormatAndViewDimension[id]) {
    const entryPoint = `fs${textureBindingViewDimension.replace(/[\W]/, '')}`;
    pipelineByFormatAndViewDimension[id] = device.createRenderPipeline({
      label: `mip level generator pipeline for ${textureBindingViewDimension}`,
      layout: 'auto',
      vertex: {
        module,
      },
      fragment: {
        module,
        entryPoint,
        targets: [{ format: texture.format }],
      },
    });
  }
  const pipeline = pipelineByFormatAndViewDimension[id];

  const encoder = device.createCommandEncoder({
    label: 'mip gen encoder',
  });

  for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; ++baseMipLevel) {
    for (let baseArrayLayer = 0; baseArrayLayer < texture.depthOrArrayLayers; ++baseArrayLayer) {
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          {
            binding: 1,
            resource: texture.createView({
              dimension: textureBindingViewDimension,
              baseMipLevel: baseMipLevel - 1,
              mipLevelCount: 1,
            }),
          },
        ],
      });

      const renderPassDescriptor: GPURenderPassDescriptor = {
        label: 'mip gen renderPass',
        colorAttachments: [
          {
            view: texture.createView({
               dimension: '2d',
               baseMipLevel,
               mipLevelCount: 1,
               baseArrayLayer,
               arrayLayerCount: 1,
            }),
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      };

      const pass = encoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3, 1, 0, baseArrayLayer);
      pass.end();
    }
  }

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
}