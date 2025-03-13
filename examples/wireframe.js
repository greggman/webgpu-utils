/* global GPUBufferUsage */
/* global GPUTextureUsage */
import { mat4, vec3 } from 'https://wgpu-matrix.org/dist/2.x/wgpu-matrix.module.js';
import * as wgh from '../dist/1.x/webgpu-utils.module.js';

async function main() {
  const adapter = await navigator.gpu?.requestAdapter({
    featureLevel: 'compatibility',
  });
  const { maxStorageBuffersInVertexStage } = adapter?.limits.maxStorageBuffersInVertexStage ?? {};
  if (maxStorageBuffersInVertexStage < 2) {
    fail('your device does not support support the needed functionality for this example');
    return;
  }
  const device = await adapter?.requestDevice({
    requiredLimits: {
      maxStorageBuffersInVertexStage,
    },
  });
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
  @group(0) @binding(1) var<uniform> sharedUni: SharedUniforms;

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

  const wireframeCode = `
    struct Uniforms {
      world: mat4x4f,
      color: vec4f,
    };

    struct SharedUniforms {
      viewProjection: mat4x4f,
      lightDirection: vec3f,
    };

    @group(0) @binding(0) var<uniform> uni: Uniforms;
    @group(0) @binding(1) var<uniform> sharedUni: SharedUniforms;

    @group(0) @binding(2) var<storage, read> positions: array<f32>;
    @group(0) @binding(3) var<storage, read> indices: array<u32>;
    @group(0) @binding(4) var<uniform> stride: u32;

    struct MyVSOutput {
      @builtin(position) pos: vec4f,
    };

    @vertex
    fn myVSMain(@builtin(vertex_index) vNdx: u32) -> MyVSOutput {
      var vsOut: MyVSOutput;
      // indices make a triangle so for every 3 indices we need to output
      // 6 values
      let triNdx = vNdx / 6;
      // 0 1 0 1 0 1  0 1 0 1 0 1  vNdx % 2
      // 0 0 1 1 2 2  3 3 4 4 5 5  vNdx / 2
      // 0 1 1 2 2 3  3 4 4 5 5 6  vNdx % 2 + vNdx / 2
      // 0 1 1 2 2 0  0 1 1 2 2 0  (vNdx % 2 + vNdx / 2) % 3
      let vertNdx = (vNdx % 2 + vNdx / 2) % 3;
      let index = indices[triNdx * 3 + vertNdx];
      let pNdx = index * stride;
      let position = vec4f(positions[pNdx], positions[pNdx + 1], positions[pNdx + 2], 1);
      vsOut.pos = sharedUni.viewProjection * uni.world * position;
      return vsOut;
    }

    @fragment
    fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
      return uni.color;
    }
  `;

  function facet(arrays) {
    const newArrays = wgh.primitives.deindex(arrays);
    newArrays.normal = wgh.primitives.generateTriangleNormals(wgh.makeTypedArrayFromArrayUnion(newArrays.position, 'position'));
    return newArrays;
  }

  function createBuffersAndAttributesFromArraysWithStorageUsage(device, arrays) {
    arrays.indices = new Uint32Array(arrays.indices);
    return wgh.createBuffersAndAttributesFromArrays(device, arrays, {
      usage: GPUBufferUsage.STORAGE,
    });
  }

  const numInstances = 1000;
  const geometries = [
    createBuffersAndAttributesFromArraysWithStorageUsage(device, wgh.primitives.createSphereVertices()),
    //createBuffersAndAttributesFromArraysWithStorageUsage(device, facet(wgh.primitives.createSphereVertices({subdivisionsAxis: 6, subdivisionsHeight: 5}))),
    createBuffersAndAttributesFromArraysWithStorageUsage(device, wgh.primitives.createTorusVertices()),
    //createBuffersAndAttributesFromArraysWithStorageUsage(device, facet(wgh.primitives.createTorusVertices({thickness: 0.5, radialSubdivisions: 8, bodySubdivisions: 8}))),
    createBuffersAndAttributesFromArraysWithStorageUsage(device, wgh.primitives.createCubeVertices()),
    createBuffersAndAttributesFromArraysWithStorageUsage(device, wgh.primitives.createCylinderVertices()),
    //createBuffersAndAttributesFromArraysWithStorageUsage(device, facet(wgh.primitives.createCylinderVertices({radialSubdivisions: 7}))),
    /////createBuffersAndAttributesFromArraysWithStorageUsage(device, wgh.primitives.createPlaneVertices()),
    /////createBuffersAndAttributesFromArraysWithStorageUsage(device, wgh.primitives.createDiscVertices()),
    createBuffersAndAttributesFromArraysWithStorageUsage(device, wgh.primitives.createTruncatedConeVertices()),
  ];

  function r(min, max) {
    if (typeof max === 'undefined') {
      max = min;
      min = 0;
    }
    return Math.random() * (max - min) + min;
  }

  const randElem = arr => arr[r(arr.length) | 0];

  const module = device.createShaderModule({code});
  const wireframeModule = device.createShaderModule({code: wireframeCode});

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        ...geometries[0].bufferLayouts,
      ],
    },
    fragment: {
      module,
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
      depthBias: 1,
      depthBiasSlopeScale: 0.5,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });

  const wireframePipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: wireframeModule,
    },
    fragment: {
      module: wireframeModule,
      targets: [
        {format: presentationFormat},
      ],
    },
    primitive: {
      topology: 'line-list',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less-equal',
      format: 'depth24plus',
    },
  });

  const defs = wgh.makeShaderDataDefinitions(code);
  const wireframeDefs = wgh.makeShaderDataDefinitions(wireframeCode);
  const sharedUniformValues = wgh.makeStructuredView(defs.uniforms.sharedUni);

  const sharedUniformBuffer = device.createBuffer({
    size: sharedUniformValues.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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

    const geometry = randElem(geometries);

    const strideView = wgh.makeStructuredView(wireframeDefs.uniforms.stride);
    const strideBuffer = device.createBuffer({
      size: strideView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    strideView.views.set([geometry.bufferLayouts[0].arrayStride / 4]);

    device.queue.writeBuffer(strideBuffer, 0, strideView.arrayBuffer);

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: sharedUniformBuffer } },
      ],
    });

    const wireframeBindGroup = device.createBindGroup({
      layout: wireframePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: sharedUniformBuffer } },
        { binding: 2, resource: { buffer: geometry.buffers[0] } },
        { binding: 3, resource: { buffer: geometry.indexBuffer } },
        { binding: 4, resource: { buffer: strideBuffer } },
      ],
    });

    objectInfos.push({
      uniformView,
      uniformBuffer,
      wireframeBindGroup,
      bindGroup,
      geometry,
    });
  }

  const renderPassDescriptor = {
    colorAttachments: [
      {
        // view: undefined, // Assigned later
        clearValue: [ 0.2, 0.2, 0.2, 1.0 ],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      // view: undefined,  // Assigned later
      depthClearValue: 1,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  };

  let depthTexture;

  function render(time) {
    time *= 0.001;

    const projection = mat4.perspective(30 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.5, 100);
    const radius = 35;
    const t = time * 0.1;
    const eye = [Math.cos(t) * radius, 4, Math.sin(t) * radius];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    const view = mat4.lookAt(eye, target, up);
    mat4.multiply(projection, view, sharedUniformValues.views.viewProjection);

    sharedUniformValues.set({
      lightDirection: vec3.normalize([1, 8, 10]),
    });

    device.queue.writeBuffer(sharedUniformBuffer, 0, sharedUniformValues.arrayBuffer);

    const canvasTexture = context.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].view = canvasTexture.createView();

    // If we don't have a depth texture OR if its size is different
    // from the canvasTexture when make a new depth texture
    if (!depthTexture ||
        depthTexture.width !== canvasTexture.width ||
        depthTexture.height !== canvasTexture.height) {
      if (depthTexture) {
        depthTexture.destroy();
      }
      depthTexture = device.createTexture({
        size: [canvasTexture.width, canvasTexture.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    objectInfos.forEach(({
      bindGroup,
      geometry,
      uniformBuffer,
      uniformView,
    }, i) => {
      const world = uniformView.views.world;
      mat4.identity(world);
      mat4.translate(world, [0, 0, Math.sin(i * 3.721 + time * 0.1) * 10], world);
      mat4.rotateX(world, i * 4.567, world);
      mat4.rotateY(world, i * 2.967, world);
      mat4.translate(world, [0, 0, Math.sin(i * 9.721 + time * 0.1) * 10], world);
      mat4.rotateX(world, time * 0.53 + i, world);

      device.queue.writeBuffer(uniformBuffer, 0, uniformView.arrayBuffer);

      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.setVertexBuffer(0, geometry.buffers[0]);
      if (geometry.indexBuffer) {
        passEncoder.setIndexBuffer(geometry.indexBuffer, geometry.indexFormat);
        passEncoder.drawIndexed(geometry.numElements);
      } else {
        passEncoder.draw(geometry.numElements);
      }
    });
    passEncoder.setPipeline(wireframePipeline);
    objectInfos.forEach(({
      wireframeBindGroup,
      geometry,
    }) => {
      passEncoder.setBindGroup(0, wireframeBindGroup);
      passEncoder.draw(geometry.numElements * 2);
    });

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
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
