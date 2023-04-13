import {
   isTypedArray
} from './utils.js';

function normalizeGPUExtent3Dict(size: GPUExtent3DDict) {
   return [size.width, size.height || 1, size.depthOrArrayLayers || 1];
}

export function normalizeGPUExtent3D(size: GPUExtent3D): number[] {
   return (Array.isArray(size) || isTypedArray(size))
      ? Array.from(size as Iterable<number>)
      : normalizeGPUExtent3Dict(size as GPUExtent3DDict);
}

export function numMipLevels(size: GPUExtent3D) {
    const sizes = normalizeGPUExtent3D(size);
    const maxSize = Math.max(...sizes);
    return 1 + Math.log2(maxSize) | 0;
}

// Use a WeakMap so the device can be destroyed and/or lost
const byDevice = new WeakMap();

export function generateMipmap(device: GPUDevice, texture: GPUTexture) {
   let perDeviceInfo = byDevice.get(device);
   if (!perDeviceInfo) {
      perDeviceInfo = {
         pipelineByFormat: {},
      };
      byDevice.set(device, perDeviceInfo);
   }
   let {
      sampler,
      module,
   } = perDeviceInfo;
   const {
      pipelineByFormat,
   } = perDeviceInfo;

   if (!module) {
      module = device.createShaderModule({
         label: 'mip level generation',
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
            @group(0) @binding(1) var ourTexture: texture_2d<f32>;

            @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
               return textureSample(ourTexture, ourSampler, fsInput.texcoord);
            }
         `,
      });

      sampler = device.createSampler({
         minFilter: 'linear',
      });

      perDeviceInfo.module = module;
      perDeviceInfo.sampler = sampler;
   }

   if (!pipelineByFormat[texture.format]) {
      pipelineByFormat[texture.format] = device.createRenderPipeline({
         label: 'mip level generator pipeline',
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
   const pipeline = pipelineByFormat[texture.format];

   const encoder = device.createCommandEncoder({
      label: 'mip gen encoder',
   });

   let width = texture.width;
   let height = texture.height;
   let baseMipLevel = 0;
   while (width > 1 || height > 1) {
      width = Math.max(1, width / 2 | 0);
      height = Math.max(1, height / 2 | 0);

      const bindGroup = device.createBindGroup({
         layout: pipeline.getBindGroupLayout(0),
         entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: texture.createView({baseMipLevel, mipLevelCount: 1}) },
         ],
      });

      ++baseMipLevel;

      const renderPassDescriptor: GPURenderPassDescriptor = {
         label: 'mip gen renderPass',
         colorAttachments: [
            {
               view: texture.createView({baseMipLevel, mipLevelCount: 1}),
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

   const commandBuffer = encoder.finish();
   device.queue.submit([commandBuffer]);
}