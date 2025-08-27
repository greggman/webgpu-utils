/* global GPUBufferUsage */
/* global GPUTextureUsage */
import { mat4, vec3 } from 'https://wgpu-matrix.org/dist/2.x/wgpu-matrix.module.js';
import * as wgh from '../dist/2.x/webgpu-utils.module.js';

async function main() {
  const adapter = await navigator.gpu?.requestAdapter({
    featureLevel: 'compatibility',
  });
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  const code = `
  struct Uniforms {
    world: mat4x4f,
    color: vec4f,
  };

  struct SharedUniforms {
    viewProjection: mat4x4f,
    lightDirection: vec3f,
  };

  @group(0) @binding(0) var<uniform> uni: Uniforms;
  @group(1) @binding(0) var<uniform> sharedUni: SharedUniforms;

  struct MyVSInput {
      @location(0) position: vec4f,
      @location(1) normal: vec3f,
      @location(2) texcoord: vec2f,
  };

  struct MyVSOutput {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) texcoord: vec2f,
  };

  @vertex
  fn myVSMain(v: MyVSInput) -> MyVSOutput {
    var vsOut: MyVSOutput;
    vsOut.position = sharedUni.viewProjection * uni.world * v.position;
    vsOut.normal = (uni.world * vec4f(v.normal, 0.0)).xyz;
    vsOut.texcoord = v.texcoord;
    return vsOut;
  }

  @fragment
  fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
    let diffuseColor = uni.color;
    let a_normal = normalize(v.normal);
    let l = dot(a_normal, sharedUni.lightDirection) * 0.5 + 0.5;
    return vec4f(diffuseColor.rgb * l, diffuseColor.a);
  }
  `;
  const defs = wgh.makeShaderDataDefinitions(code);

  const descriptors = wgh.makeBindGroupLayoutDescriptors(defs, {vertex: {}, fragment: {}});
  const bindGroupLayouts = descriptors.map(desc => device.createBindGroupLayout(desc));
  const layout = device.createPipelineLayout({ bindGroupLayouts });

  const numInstances = 50;
  const geometries = [
    wgh.createBuffersAndAttributesFromArrays(device, wgh.primitives.createSphereVertices({subdivisionsAxis: 64, subdivisionsHeight: 32, radius: 0.5 })),
    wgh.createBuffersAndAttributesFromArrays(device, wgh.primitives.createCubeVertices()),
  ];

  function r(min, max) {
    if (typeof max === 'undefined') {
      max = min;
      min = 0;
    }
    return Math.random() * (max - min) + min;
  }

  const module = device.createShaderModule({code});

  const pipelinesAndRenderPassDescriptors = [
    {
      depthCompare: 'greater',
      depthClearValue: 0,
      perspective: (f, a, n) => mat4.perspectiveReverseZ(f, a, n),
      clearValue: [ 0.2, 0.2, 0.2, 1.0 ],
      loadOp: 'clear',
    },
    {
      depthCompare: 'less',
      depthClearValue: 1,
      perspective: mat4.perspective,
      loadOp: 'load',
    },
  ].map(settings => {
    const pipeline = device.createRenderPipeline({
      layout,
      vertex: {
        module,
        entryPoint: 'myVSMain',
        buffers: [
          ...geometries[0].bufferLayouts,
        ],
      },
      fragment: {
        module,
        entryPoint: 'myFSMain',
        targets: [
          {format: presentationFormat},
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        depthWriteEnabled: true,
        ...settings,
        format: 'depth32float',
      },
    });

    const renderPassDescriptor = {
      colorAttachments: [
        {
          // view: undefined, // Assigned later
          ...settings,
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        // view: undefined,  // Assigned later
        ...settings,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };

    const sharedUniformValues = wgh.makeStructuredView(defs.uniforms.sharedUni);

    const sharedUniformBuffer = device.createBuffer({
      size: sharedUniformValues.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const sharedBindGroup = device.createBindGroup({
      layout: bindGroupLayouts[1],
      entries: [
        { binding: 0, resource: { buffer: sharedUniformBuffer } },
      ],
    });

    return {
      pipeline,
      renderPassDescriptor,
      sharedUniformValues,
      sharedUniformBuffer,
      sharedBindGroup,
      ...settings,
    };
  });

  const objectInfos = [];
  for (let i = 0; i < numInstances; ++i) {
    const uniformView = wgh.makeStructuredView(defs.uniforms.uni);
    const uniformBuffer = device.createBuffer({
      size: uniformView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    uniformView.views.color.set([r(1), r(1), r(1), 1]);

    device.queue.writeBuffer(uniformBuffer, 0, uniformView.arrayBuffer);

    const bindGroup = device.createBindGroup({
      layout: bindGroupLayouts[0],
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
      ],
    });

    objectInfos.push({
      uniformView,
      uniformBuffer,
      bindGroup,
      geometry: geometries[(i / 2 | 0) % geometries.length],
    });
  }

  let depthTexture;

  function render(time) {
    time *= 0.001;

    objectInfos.forEach(({
      uniformBuffer,
      uniformView,
    }, i) => {
      const p = i / 2 | 0;
      const world = uniformView.views.world;
      const size = 800;
      mat4.identity(world);
      mat4.translate(world, [0, 0, size * p * 1.1], world);
      const s = i % 2 ? size : size - 0.1;
      mat4.scale(world, [s, s, s], world);

      device.queue.writeBuffer(uniformBuffer, 0, uniformView.arrayBuffer);
    });

    const encoder = device.createCommandEncoder();
    pipelinesAndRenderPassDescriptors.forEach(({
      pipeline,
      renderPassDescriptor,
      perspective,
      sharedUniformBuffer,
      sharedUniformValues,
      sharedBindGroup,
    }, pNdx) => {
      const projection = perspective(90 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.5, 10000);
      const radius = 1000;
      const t = time * 0.1;
      const eye = [Math.cos(t) * radius, Math.sin(t) * radius, -600]; //[Math.cos(t) * radius, Math.sin(t) * radius, 1000];
      const target = [0, 0, 2000];
      const up = [0, 1, 0];

      const view = mat4.lookAt(eye, target, up);
      mat4.multiply(projection, view, sharedUniformValues.views.viewProjection);

      sharedUniformValues.set({
        lightDirection: vec3.normalize([1, 8, -10]),
      });

      device.queue.writeBuffer(sharedUniformBuffer, 0, sharedUniformValues.arrayBuffer);

      const canvasTexture = context.getCurrentTexture();
      renderPassDescriptor.colorAttachments[0].view = canvasTexture.createView();

      // If we don't have a depth texture OR if its size is different
      // from the canvasTexture then make a new depth texture
      if (!depthTexture ||
          depthTexture.width !== canvasTexture.width ||
          depthTexture.height !== canvasTexture.height) {
        if (depthTexture) {
          depthTexture.destroy();
        }
        depthTexture = device.createTexture({
          size: [canvasTexture.width, canvasTexture.height],
          format: 'depth32float',
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
      }
      renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();

      // TODO: Consider a render bundle
      const pass = encoder.beginRenderPass(renderPassDescriptor);
      const h = canvasTexture.height / 2 | 0;
      const y = pNdx * h;
      pass.setScissorRect(0, y, canvasTexture.width, h);
      pass.setPipeline(pipeline);
      pass.setBindGroup(1, sharedBindGroup);
      objectInfos.forEach(({
        bindGroup,
        geometry,
      }) => {
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, geometry.buffers[0]);
        if (geometry.indexBuffer) {
          pass.setIndexBuffer(geometry.indexBuffer, geometry.indexFormat);
          pass.drawIndexed(geometry.numElements);
        } else {
          pass.draw(geometry.numElements);
        }
      });
      pass.end();
    });
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize * 2;
      const height = entry.contentBoxSize[0].blockSize * 2;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
    }
  });
  observer.observe(canvas);
}

function fail(msg) {
  const elem = document.querySelector('#fail');
  elem.style.display = '';
  elem.children[0].textContent = msg;
}

main();
