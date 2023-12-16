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
    worldViewProjection: mat4x4f,
    worldInverseTranspose: mat4x4f,
  };
  @group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;

  struct MyVSInput {
      @location(0) position: vec4f,
      @location(1) normal: vec3f,
  };

  struct MyVSOutput {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
  };

  @vertex
  fn myVSMain(v: MyVSInput) -> MyVSOutput {
    var vsOut: MyVSOutput;
    vsOut.position = vsUniforms.worldViewProjection * v.position;
    vsOut.normal = (vsUniforms.worldInverseTranspose * vec4f(v.normal, 0.0)).xyz;
    return vsOut;
  }

  struct FSUniforms {
    color: vec4f,
    lightDirection: vec3f,
  };

  @group(0) @binding(1) var<uniform> fsUniforms: FSUniforms;

  struct FSOutput {
    @location(0) color: vec4f,
    @location(1) normal: vec4f,
  }

  @fragment
  fn myFSMain(v: MyVSOutput) -> FSOutput {
    let diffuseColor = fsUniforms.color;
    let a_normal = normalize(v.normal);
    let l = 1.0;//dot(a_normal, fsUniforms.lightDirection) * 0.5 + 0.5;
    
    var fsOut: FSOutput;
    fsOut.color = vec4f(diffuseColor.rgb * l, diffuseColor.a);
    fsOut.normal = vec4f(a_normal * 0.5 + 0.5, 1);
    return fsOut;
  }
  `;

  const code2 = `
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

    @group(0) @binding(0) var colorTexture: texture_2d<f32>;
    @group(0) @binding(1) var depthTexture: texture_2d<f32>;
    @group(0) @binding(2) var normalTexture: texture_2d<f32>;

    @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
      let xy = vec2u(fsInput.position.xy);
      let color = textureLoad(colorTexture, xy, 0);
      let normal = textureLoad(normalTexture, xy, 0).xyz * 2.0 - 1.0;
      let normalR = textureLoad(normalTexture, xy + vec2u(4, 0), 0).xyz * 2.0 - 1.0;
      let normalL = textureLoad(normalTexture, xy + vec2u(0, 4), 0).xyz * 2.0 - 1.0;
      let depth = textureLoad(depthTexture, xy, 0).r;
      let depthR = textureLoad(depthTexture, xy + vec2u(2, 0), 0).r;
      let depthU = textureLoad(depthTexture, xy + vec2u(0, 2), 0).r;
      let maxDepthDiff = max(abs(depth - depthR), abs(depth - depthU));
      let dotR = 1.0 - (dot(normal, normalR) * 0.5 + 0.5);
      let dotL = 1.0 - (dot(normal, normalL) * 0.5 + 0.5);
      let maxDot = max(dotR, dotL);
      let c = mix(color, vec4f(1), saturate(maxDot + maxDepthDiff)); // > 0.1 || maxDepthDiff > 0.15);
      return c;
    }
  `;

  const {
    buffers,
    bufferLayouts,
    indexBuffer,
    indexFormat,
    numElements,
  } = wgh.createBuffersAndAttributesFromArrays(device, wgh.primitives.createCylinderVertices({radius: 2, height: 4}));

  const module = device.createShaderModule({code});
  const module2 = device.createShaderModule({code: code2});

  const pipeline = device.createRenderPipeline({
    label: 'draw geo',
    layout: 'auto',
    vertex: { module, entryPoint: 'myVSMain', buffers: bufferLayouts, },
    fragment: { module, entryPoint: 'myFSMain', targets: [ {format: presentationFormat}, {format: presentationFormat} ], },
    primitive: { topology: 'triangle-list', cullMode: 'back', },
    depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus', },
  });

  const pipeline2 = device.createRenderPipeline({
    label: 'post process',
    layout: 'auto',
    vertex: { module: module2, entryPoint: 'vs' },
    fragment: { module: module2, entryPoint: 'fs', targets: [ {format: presentationFormat} ], },
    primitive: { topology: 'triangle-list' },
  });
  const hsl = (h, s, l) => `hsl(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%)`;

  const cssColorToRGBA8 = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    return cssColor => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    };
  })();

  const cssColorToRGBA = cssColor => cssColorToRGBA8(cssColor).map(v => v / 255);

  const defs = wgh.makeShaderDataDefinitions(code);
  const objectInfos = [];
  const across = 20;
  const numObjects = across * across;
  for (let i = 0; i < numObjects; ++i) {
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

    fsUniformValues.set({
      lightDirection: vec3.normalize([1, 8, -10]),
      color: cssColorToRGBA(hsl(i / numObjects * 0.2 + 0.6, 1, .6)),
    });

    device.queue.writeBuffer(fsUniformBuffer, 0, fsUniformValues.arrayBuffer);

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: vsUniformBuffer } },
        { binding: 1, resource: { buffer: fsUniformBuffer } },
      ],
    });
    objectInfos.push({
      vsUniformValues,
      fsUniformValues,
      vsUniformBuffer,
      fsUniformBuffer,
      bindGroup,
    });
  }

  const renderPassDescriptor = {
    label: 'draw geo',
    colorAttachments: [
      {
        // view: undefined, // Assigned later
        clearValue: [ 0.0, 0.0, 0.0, 1.0 ],
        loadOp: 'clear',
        storeOp: 'store',
      },
      {
        // view: undefined, // Assigned later
        clearValue: [ 0.0, 0.0, 0.0, 1.0 ],
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

  const renderPassDescriptor2 = {
    label: 'post process',
    colorAttachments: [
      {
        // view: undefined, // Assigned later
        clearValue: [ 0.0, 0.0, 0.0, 1.0 ],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  let requestId;
  let running;
  let then = 0;
  let time = 0;
  function startAnimation() {
    running = true;
    requestAnimation();
  }

  function stopAnimation() {
    running = false;
  }

  function requestAnimation() {
    if (!requestId) {
      requestId = requestAnimationFrame(render);
    }
  }

  let depthTexture;
  let colorTexture;
  let normalTexture;
  let postBindGroup;

  function render(now) {
    requestId = undefined;

    const elapsed = Math.min(now - then, 1000 / 10);
    then = now;
    if (running) {
      time += elapsed * 0.001;
    }

    /*
           y/2
         / |
        /  |
       /  _|
      /\ | |
    fovY/2-zNear

    sohcahtoa   fovY/2 =  (y/2) / zNear

    */

    const depth = 60;
    const fov = Math.atan((across * 1) / (depth - 1) * 2);
    const maxFovX = fov;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const fovX = (2 * Math.atan(Math.tan((fov) * 0.5) * aspect));
    const newFovY = (2 * Math.atan(Math.tan((maxFovX) * .5) / aspect));
    const fovY = fovX > maxFovX ? newFovY : fov;

    const projection = mat4.perspective(fovY, aspect, depth - 4, depth + 4);
    const spacing = 2.5;
    const half = across * spacing * 0.5;
    const eye = [half, half, depth];
    const target = [half, half, 0];
    const t = time * 0.01 + 0.2;
    const up = [Math.sin(t), Math.cos(t), 0];

    const view = mat4.lookAt(eye, target, up);
    const viewProjection = mat4.multiply(projection, view);

    const canvasTexture = context.getCurrentTexture();

    // If we don't have a depth texture OR if its size is different
    // from the canvasTexture when make a new depth texture
    if (!depthTexture ||
        depthTexture.width !== canvasTexture.width ||
        depthTexture.height !== canvasTexture.height) {
      if (depthTexture) {
        depthTexture.destroy();
        colorTexture.destroy();
      }
      depthTexture = device.createTexture({
        size: canvasTexture,
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      colorTexture = device.createTexture({
        size: canvasTexture,
        format: presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      normalTexture = device.createTexture({
        size: canvasTexture,
        format: presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      postBindGroup = device.createBindGroup({
        layout: pipeline2.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: colorTexture.createView() },
          { binding: 1, resource: depthTexture.createView() },
          { binding: 2, resource: normalTexture.createView() },
        ],
      });
    }
    renderPassDescriptor.colorAttachments[0].view = colorTexture.createView();
    renderPassDescriptor.colorAttachments[1].view = normalTexture.createView();
    renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();
    renderPassDescriptor2.colorAttachments[0].view = canvasTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    {
      const pass = commandEncoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, buffers[0]);
      pass.setIndexBuffer(indexBuffer, indexFormat);

      const t = time * 0.025 + 0.5;
      objectInfos.forEach(({vsUniformBuffer, vsUniformValues, bindGroup}, i) => {
        const m = vsUniformValues.views.worldViewProjection;
        mat4.translation([i % across * spacing, (i / across | 0) * spacing, 0], m);
        mat4.rotateY(m, t + i * 0.02, m);
        mat4.rotateZ(m, t, m);
        mat4.transpose(mat4.inverse(m), vsUniformValues.views.worldInverseTranspose);
        mat4.multiply(viewProjection, m, m);

        device.queue.writeBuffer(vsUniformBuffer, 0, vsUniformValues.arrayBuffer);

        pass.setBindGroup(0, bindGroup);
        pass.drawIndexed(numElements);
      });

      pass.end();
    }

    {
      const pass = commandEncoder.beginRenderPass(renderPassDescriptor2);
      pass.setPipeline(pipeline2);
      pass.setBindGroup(0, postBindGroup);
      pass.draw(3);
      pass.end();
    }

    device.queue.submit([commandEncoder.finish()]);

    if (running) {
      requestAnimation(render);
    }
  }

  const motionQuery = matchMedia('(prefers-reduced-motion)');
  function handleReduceMotionChanged() {
    if (motionQuery.matches) {
      stopAnimation();
    } else {
      startAnimation();
    }
  }
  motionQuery.addEventListener('change', handleReduceMotionChanged);
  handleReduceMotionChanged();
  requestAnimation();

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize * 4;
      const height = entry.contentBoxSize[0].blockSize * 4;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      requestAnimation(render);
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
