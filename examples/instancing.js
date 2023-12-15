/* global GPUBufferUsage */
/* global GPUTextureUsage */
import { mat4, vec3 } from 'https://wgpu-matrix.org/dist/2.x/wgpu-matrix.module.js';
import * as wgh from '../dist/1.x/webgpu-utils.module.js';

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
    viewProjection: mat4x4f,
  };
  @group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;

  struct MyVSInput {
      @location(0) position: vec4f,
      @location(1) normal: vec3f,
      @location(2) texcoord: vec2f,
      @location(3) matrix0: vec4f,
      @location(4) matrix1: vec4f,
      @location(5) matrix2: vec4f,
      @location(6) matrix3: vec4f,
      @location(7) color: vec4f,
  };

  struct MyVSOutput {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) texcoord: vec2f,
    @location(2) color: vec4f,
  };

  @vertex
  fn myVSMain(v: MyVSInput) -> MyVSOutput {
    let mat = mat4x4f(v.matrix0, v.matrix1, v.matrix2, v.matrix3);
    var vsOut: MyVSOutput;
    vsOut.position = vsUniforms.viewProjection * mat * v.position;
    vsOut.normal = (mat * vec4f(v.normal, 0.0)).xyz;
    vsOut.texcoord = v.texcoord;
    vsOut.color = v.color;
    return vsOut;
  }

  struct FSUniforms {
    lightDirection: vec3f,
  };

  @group(0) @binding(1) var<uniform> fsUniforms: FSUniforms;

  @fragment
  fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
    let diffuseColor = v.color;
    let a_normal = normalize(v.normal);
    let l = dot(a_normal, fsUniforms.lightDirection) * 0.5 + 0.5;
    return vec4f(diffuseColor.rgb * l, diffuseColor.a);
  }
  `;

  const numInstances = 1000;
  const nonInstancedVerts = wgh.createBuffersAndAttributesFromArrays(device, {
    position: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
    normal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
    texcoord: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
  });

  function r(min, max) {
    if (typeof max === 'undefined') {
      max = min;
      min = 0;
    }
    return Math.random() * (max - min) + min;
  }

  const matrices = new Float32Array(numInstances * 16);
  const colors = new Uint8Array(numInstances * 4);
  for (let i = 0; i < numInstances; ++i) {
    const color = wgh.subarray(colors, i * 4, 4);
    color.set([r(256), r(256), r(256), 1]);

    const matrix = wgh.subarray(matrices, i * 16, 16);
    const t = vec3.mulScalar(vec3.normalize([r(-1, 1), r(-1, 1), r(-1, 1)]), 10);
    mat4.translation(t, matrix);
    mat4.rotateX(matrix, r(Math.PI * 2), matrix);
    mat4.rotateY(matrix, r(Math.PI), matrix);
    const s = r(0.25, 1);
    mat4.scale(matrix, [s, s, s], matrix);
  }

  const instancedVerts = wgh.createBuffersAndAttributesFromArrays(device, {
    matrix: {
      data: matrices, //numInstances * 16,
      type: Float32Array,
      numComponents: 16,
    },
    color: {
      data: colors, // numInstances * 4,
      type: Uint8Array,
    },
  }, { stepMode: 'instance', interleave: false, shaderLocation: 3 });

  const module = device.createShaderModule({code});

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'myVSMain',
      buffers: [
        ...nonInstancedVerts.bufferLayouts,
        ...instancedVerts.bufferLayouts,
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
      depthCompare: 'less',
      format: 'depth24plus',
    },
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
    mat4.multiply(projection, view, vsUniformValues.views.viewProjection);

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
    passEncoder.setVertexBuffer(0, nonInstancedVerts.buffers[0]);
    passEncoder.setVertexBuffer(1, instancedVerts.buffers[0]);
    passEncoder.setVertexBuffer(2, instancedVerts.buffers[1]);
    passEncoder.setIndexBuffer(nonInstancedVerts.indexBuffer, nonInstancedVerts.indexFormat);
    passEncoder.drawIndexed(nonInstancedVerts.numElements, instancedVerts.numElements);
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
