/* global GPUBufferUsage */
/* global GPUTextureUsage */
import { mat4, vec3 } from 'https://wgpu-matrix.org/dist/2.x/wgpu-matrix.module.js';
import * as wgh from '../dist/2.x/webgpu-utils.module.js';

// note: There is nothing special about webgpu-utils with relation to stencils
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

  const sphereGeo = wgh.createBuffersAndAttributesFromArrays(device, wgh.primitives.createSphereVertices());
  const torusGeo = wgh.createBuffersAndAttributesFromArrays(device, wgh.primitives.createTorusVertices({thickness: 0.5}));
  const cubeGeo = wgh.createBuffersAndAttributesFromArrays(device, wgh.primitives.createCubeVertices());

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

  const module = device.createShaderModule({code});
  const defs = wgh.makeShaderDataDefinitions(code);
  const pipelineDesc = {
    vertex: {
      module,
      buffers: [
        ...sphereGeo.bufferLayouts,
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
      depthCompare: 'less',
      stencilFront: { passOp: 'replace' },
      format: 'depth24plus-stencil8',
    },
  };
  const descriptors = wgh.makeBindGroupLayoutDescriptors(defs, pipelineDesc);
  const bindGroupLayouts = descriptors.map(desc => device.createBindGroupLayout(desc));
  const layout = device.createPipelineLayout({ bindGroupLayouts });

  pipelineDesc.layout = layout;
  const stencilSetPipeline = device.createRenderPipeline(pipelineDesc);
  pipelineDesc.depthStencil.stencilFront.passOp = 'keep';
  pipelineDesc.depthStencil.stencilFront.compare = 'equal';
  const stencilMaskPipeline = device.createRenderPipeline(pipelineDesc);

  function r(min, max) {
    if (typeof max === 'undefined') {
      max = min;
      min = 0;
    }
    return Math.random() * (max - min) + min;
  }

  const randElem = arr => arr[r(arr.length) | 0];

  function makeScene(numInstances, geometries) {
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

      const bindGroup = device.createBindGroup({
        layout: bindGroupLayouts[0],
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: sharedUniformBuffer } },
        ],
      });

      objectInfos.push({
        uniformView,
        uniformBuffer,
        bindGroup,
        geometry: randElem(geometries),
      });
    }
    return {
      objectInfos,
      sharedUniformBuffer,
      sharedUniformValues,
    };
  }

  const maskScene = makeScene(1, [torusGeo]);
  const scene0 = makeScene(100, [sphereGeo]);
  const scene1 = makeScene(100, [cubeGeo]);

  let depthTexture;
  let canvasTexture;

  function updateMask(time, {objectInfos, sharedUniformBuffer, sharedUniformValues}) {
    const projection = mat4.perspective(30 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.5, 100);
    const eye = [0, 0, 45];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    const view = mat4.lookAt(eye, target, up);
    mat4.multiply(projection, view, sharedUniformValues.views.viewProjection);

    sharedUniformValues.set({
      lightDirection: vec3.normalize([1, 8, 10]),
    });

    device.queue.writeBuffer(sharedUniformBuffer, 0, sharedUniformValues.arrayBuffer);

    objectInfos.forEach(({
      uniformBuffer,
      uniformView,
    }) => {
      const world = uniformView.views.world;
      mat4.identity(world);
      mat4.rotateX(world, time * 0.3, world);
      mat4.rotateY(world, time * 0.51, world);
      mat4.scale(world, [4, 4, 4], world);
      device.queue.writeBuffer(uniformBuffer, 0, uniformView.arrayBuffer);
    });
  }

  function updateScene0(time, {objectInfos, sharedUniformBuffer, sharedUniformValues}) {
    const projection = mat4.perspective(30 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.5, 100);
    const eye = [0, 0, 35];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    const view = mat4.lookAt(eye, target, up);
    mat4.multiply(projection, view, sharedUniformValues.views.viewProjection);

    sharedUniformValues.set({
      lightDirection: vec3.normalize([1, 8, 10]),
    });

    device.queue.writeBuffer(sharedUniformBuffer, 0, sharedUniformValues.arrayBuffer);

    objectInfos.forEach(({
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
    });
  }

  function updateScene1(time, {objectInfos, sharedUniformBuffer, sharedUniformValues}) {
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

    objectInfos.forEach(({
      uniformBuffer,
      uniformView,
    }, i) => {
      const world = uniformView.views.world;
      mat4.identity(world);
      mat4.translate(world, [0, 0, Math.sin(i * 3.721 + time * 0.1) * 10], world);
      mat4.rotateX(world, i * 4.567, world);
      mat4.rotateY(world, i * 2.967, world);
      mat4.translate(world, [0, 0, Math.sin(i * 9.721 + time * 0.1) * 10], world);
      mat4.rotateX(world, time * 1.53 + i, world);
      device.queue.writeBuffer(uniformBuffer, 0, uniformView.arrayBuffer);
    });
  }

  function drawScene(encoder, renderPassDescriptor, pipeline, scene, stencilRef) {
    const {
      objectInfos,
    } = scene;

    renderPassDescriptor.colorAttachments[0].view = canvasTexture.createView();
    renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();

    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setStencilReference(stencilRef);

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
  }

  const clearPassDesc = {
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
      stencilLoadOp: 'clear',
      stencilStoreOp: 'store',
    },
  };

  const loadPassDesc = {
    colorAttachments: [
      {
        // view: undefined, // Assigned later
        loadOp: 'load',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      // view: undefined,  // Assigned later
      depthClearValue: 1,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      stencilLoadOp: 'load',
      stencilStoreOp: 'store',
    },
  };

  function render(time) {
    time *= 0.001;

    canvasTexture = context.getCurrentTexture();
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
        format: 'depth24plus-stencil8',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }

    updateMask(time, maskScene);
    updateScene0(time, scene0);
    updateScene1(time, scene1);

    const encoder = device.createCommandEncoder();
    drawScene(encoder, clearPassDesc, stencilSetPipeline, maskScene, 1);
    drawScene(encoder, loadPassDesc, stencilMaskPipeline, scene0, 0);
    drawScene(encoder, loadPassDesc, stencilMaskPipeline, scene1, 1);
    device.queue.submit([encoder.finish()]);

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
