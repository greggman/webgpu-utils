/* global GPUBufferUsage */
/* global GPUTextureUsage */
import { mat4, vec3 } from 'https://wgpu-matrix.org/dist/2.x/wgpu-matrix.module.js';
import * as wgh from '../dist/0.x/webgpu-utils.module.js';

async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
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
  struct VSUniforms {
    worldViewProjection: mat4x4<f32>,
    worldInverseTranspose: mat4x4<f32>,
  };
  @group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;

  struct MyVSInput {
      @location(0) position: vec4<f32>,
      @location(1) normal: vec3<f32>,
      @location(2) texcoord: vec2<f32>,
      @location(3) faceIndex: u32,
  };

  struct MyVSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) texcoord: vec2<f32>,
    @location(2) @interpolate(flat) faceIndex: u32,
  };

  @vertex
  fn myVSMain(v: MyVSInput) -> MyVSOutput {
    var vsOut: MyVSOutput;
    vsOut.position = vsUniforms.worldViewProjection * v.position;
    vsOut.normal = (vsUniforms.worldInverseTranspose * vec4<f32>(v.normal, 0.0)).xyz;
    vsOut.texcoord = v.texcoord;
    vsOut.faceIndex = v.faceIndex;
    return vsOut;
  }

  struct FSUniforms {
    lightDirection: vec3<f32>,
    faceImageIndex: array<vec4u, 6>,
  };

  @group(0) @binding(1) var<uniform> fsUniforms: FSUniforms;
  @group(0) @binding(2) var diffuseSampler: sampler;
  @group(0) @binding(3) var diffuseTexture: texture_2d_array<f32>;

  @fragment
  fn myFSMain(v: MyVSOutput) -> @location(0) vec4<f32> {
    let imageNdx = fsUniforms.faceImageIndex[v.faceIndex][0];
    let diffuseColor = textureSample(diffuseTexture, diffuseSampler, v.texcoord, imageNdx);
    let a_normal = normalize(v.normal);
    let l = dot(a_normal, fsUniforms.lightDirection) * 0.5 + 0.5;
    
    return vec4<f32>(diffuseColor.rgb * l, diffuseColor.a);
  }
  `;


  const {
    buffers,
    bufferLayouts,
    indexBuffer,
    indexFormat,
    numElements,
  } = wgh.createBuffersAndAttributesFromArrays(device, {
    position: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
    normal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
    texcoord: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
    faceIndices: {
      data: new Uint32Array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5]),
      numComponents: 1,
    },
    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
  });

  const module = device.createShaderModule({code});

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'myVSMain', buffers: bufferLayouts, },
    fragment: { module, entryPoint: 'myFSMain', targets: [ {format: presentationFormat} ], },
    primitive: { topology: 'triangle-list', cullMode: 'back', },
    depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus', },
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
  });

  const texture = await wgh.createTextureFromImages(device, [
    "images/array/balloons.jpg",
    "images/array/biggrub.jpg",
    "images/array/curtain.jpg",
    "images/array/hamburger.jpg",
    "images/array/mascot.jpg",
    "images/array/meat.jpg",
    "images/array/orange-fruit.jpg",
    "images/array/scomp.jpg",
    "images/array/tif.jpg",
    "images/array/手拭.jpg",
    "images/array/竹輪.jpg",
    "images/array/肉寿司.jpg",
  ], {
    mips: true,
    flipY: true,
  });

  const defs = wgh.makeShaderDataDefinitions(code);
  const vsUniformValues = wgh.makeStructuredView(defs.uniforms.vsUniforms);
  const fsUniformValues = wgh.makeStructuredView(defs.uniforms.fsUniforms);

  const vsUniformBuffer = device.createBuffer({
    size: vsUniformValues.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const fsUniformBuffer = device.createBuffer({
    size: fsUniformValues.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: vsUniformBuffer } },
      { binding: 1, resource: { buffer: fsUniformBuffer } },
      { binding: 2, resource: sampler },
      { binding: 3, resource: texture.createView({ dimension: '2d-array' }) },
    ],
  });

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

  fsUniformValues.set({
    faceImageIndex: [
      0, 0, 0, 0,
      1, 0, 0, 0,
      2, 0, 0, 0,
      3, 0, 0, 0,
      4, 0, 0, 0,
      5, 0, 0, 0,
    ],
  })

  let depthTexture;
  let oldTime = 0;
  const kSwapTime = 0.25;  // every 1/4 second

  const rand = (max) => Math.random() * max;
  const randInt = (max) => Math.floor(rand(max));

  function render(time) {
    time *= 0.001;

    if (Math.floor(time / kSwapTime) !== Math.floor(oldTime / kSwapTime)) {
      oldTime = time;
      const faceNdx = randInt(6);
      const uniformNdx = faceNdx * 4;
      const imageNdx = (randInt(texture.depthOrArrayLayers - 1) + fsUniformValues.views.faceImageIndex[uniformNdx]) % texture.depthOrArrayLayers;
      fsUniformValues.views.faceImageIndex[uniformNdx] = imageNdx;
    }

    const projection = mat4.perspective(30 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.5, 10);
    const eye = [1, 4, -6];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    const view = mat4.lookAt(eye, target, up);
    const viewProjection = mat4.multiply(projection, view);
    const world = mat4.rotationY(time);
    mat4.rotateZ(world, time, world);
    mat4.transpose(mat4.inverse(world), vsUniformValues.views.worldInverseTranspose);
    mat4.multiply(viewProjection, world, vsUniformValues.views.worldViewProjection);

    fsUniformValues.set({
      lightDirection: vec3.normalize([1, 8, -10]),
    });

    device.queue.writeBuffer(vsUniformBuffer, 0, vsUniformValues.arrayBuffer);
    device.queue.writeBuffer(fsUniformBuffer, 0, fsUniformValues.arrayBuffer);

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
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, buffers[0]);
    passEncoder.setIndexBuffer(indexBuffer, indexFormat);
    passEncoder.drawIndexed(numElements);
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
  const elem = document.createElement('p');
  elem.textContent = msg;
  elem.style.color = 'red';
  document.body.appendChild(elem);
}

main();
