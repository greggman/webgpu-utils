import {
  isTypedArray,
} from './typed-arrays.js';

function getViewDimensionForTexture(texture: GPUTexture): GPUTextureViewDimension {
   switch (texture.dimension) {
      case '1d':
         return '1d';
      case '3d':
         return '3d';
      default: // to shut up TS
      case '2d':
         return texture.depthOrArrayLayers > 1 ? '2d-array' : '2d';
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
export function numMipLevels(size: GPUExtent3D) {
   const sizes = normalizeGPUExtent3D(size);
   const maxSize = Math.max(...sizes);
   return 1 + Math.log2(maxSize) | 0;
}

// Use a WeakMap so the device can be destroyed and/or lost
const byDevice = new WeakMap();

/**
 * Generates mip levels from level 0 to the last mip for an existing texture
 *
 * The texture must have been created with TEXTURE_BINDING and
 * RENDER_ATTACHMENT and been created with mip levels
 *
 * @param device
 * @param texture
 */
export function generateMipmap(device: GPUDevice, texture: GPUTexture) {
  let perDeviceInfo = byDevice.get(device);
  if (!perDeviceInfo) {
    perDeviceInfo = {
      pipelineByFormatAndView: {},
      moduleByView: {},
    };
    byDevice.set(device, perDeviceInfo);
  }
  let {
    sampler,
  } = perDeviceInfo;
  const {
    pipelineByFormatAndView,
    moduleByView,
  } = perDeviceInfo;
  const view = getViewDimensionForTexture(texture);
  let module = moduleByView[view];
  if (!module) {
    const type = view === '2d'
      ? 'texture_2d<f32>'
      : 'texture_2d_array<f32>';
    const extraSampleParamsWGSL = view === '2d'
      ? ''
      : ', 0u';
    module = device.createShaderModule({
      label: `mip level generation for ${view}`,
      code: `
        struct VSOutput {
          @builtin(position) position: vec4f,
          @location(0) texcoord: vec2f,
        };

        @vertex fn vs(
          @builtin(vertex_index) vertexIndex : u32
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
          return vsOutput;
        }

        @group(0) @binding(0) var ourSampler: sampler;
        @group(0) @binding(1) var ourTexture: ${type};

        @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
          return textureSample(ourTexture, ourSampler, fsInput.texcoord${extraSampleParamsWGSL});
        }
      `,
    });
    moduleByView[view] = module;
  }

  if (!sampler) {
    sampler = device.createSampler({
      minFilter: 'linear',
    });
    perDeviceInfo.sampler = sampler;
  }

  const id = `${texture.format}.${view}`;

  if (!pipelineByFormatAndView[id]) {
    pipelineByFormatAndView[id] = device.createRenderPipeline({
      label: `mip level generator pipeline for ${view}`,
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs',
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: texture.format }],
      },
    });
  }
  const pipeline = pipelineByFormatAndView[id];

  const encoder = device.createCommandEncoder({
    label: 'mip gen encoder',
  });

  const dimension = getViewDimensionForTexture(texture);
  for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; ++baseMipLevel) {
    for (let baseArrayLayer = 0; baseArrayLayer < texture.depthOrArrayLayers; ++baseArrayLayer) {
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          {
            binding: 1,
            resource: texture.createView({
              dimension,
              baseMipLevel: baseMipLevel - 1,
              mipLevelCount: 1,
              baseArrayLayer,
              arrayLayerCount: 1,
            }),
          },
        ],
      });

      const renderPassDescriptor: GPURenderPassDescriptor = {
        label: 'mip gen renderPass',
        colorAttachments: [
          {
            view: texture.createView({
               dimension,
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
      pass.draw(3);
      pass.end();
    }
  }

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
}