/* global GPUBufferUsage */
import { mat4 } from 'https://wgpu-matrix.org/dist/2.x/wgpu-matrix.module.js';
import * as wgh from '../dist/1.x/webgpu-utils.module.js';
import GUI from './3rdparty/muigui-0.x.module.js';

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
  struct MyVSOutput {
    @builtin(position) position: vec4f,
    @location(0) pos: vec4f,
  };

  @vertex
  fn myVSMain(@builtin(vertex_index) vNdx: u32) -> MyVSOutput {
    let pos = array(
      vec2f(-1,  3),
      vec2f(-1, -1),
      vec2f( 3, -1),
    );
    let p = vec4f(pos[vNdx], 0, 1);
    var vsOut: MyVSOutput;
    vsOut.position = p;
    vsOut.pos = p;
    return vsOut;
  }

  struct FSUniforms {
    viewDirectionProjectionInverse: mat4x4f,
  };

  @group(0) @binding(1) var<uniform> fsUniforms: FSUniforms;
  @group(0) @binding(2) var diffuseSampler: sampler;
  @group(0) @binding(3) var diffuseTexture: texture_cube<f32>;

  @fragment
  fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
    let t = fsUniforms.viewDirectionProjectionInverse * v.pos;
    return textureSample(
      diffuseTexture,
      diffuseSampler,
      normalize(t.xyz / t.w),
    );
  }
  `;

  const module = device.createShaderModule({code});

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'myVSMain',
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
    },
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
  });

  const texture = await wgh.createTextureFromImages(device, [
    'images/little_paris_under_tower/px.jpeg',
    'images/little_paris_under_tower/nx.jpeg',
    'images/little_paris_under_tower/py.jpeg',
    'images/little_paris_under_tower/ny.jpeg',
    'images/little_paris_under_tower/pz.jpeg',
    'images/little_paris_under_tower/nz.jpeg',
    // 'images/niagarafalls2s/posx.jpg',
    // 'images/niagarafalls2s/negx.jpg',
    // 'images/niagarafalls2s/posy.jpg',
    // 'images/niagarafalls2s/negy.jpg',
    // 'images/niagarafalls2s/posz.jpg',
    // 'images/niagarafalls2s/negz.jpg',
    // 'images/yokohama/posx.jpg',
    // 'images/yokohama/negx.jpg',
    // 'images/yokohama/posy.jpg',
    // 'images/yokohama/negy.jpg',
    // 'images/yokohama/posz.jpg',
    // 'images/yokohama/negz.jpg',
  ], {
    mips: true,
    viewDimension: 'cube',
  });

  const defs = wgh.makeShaderDataDefinitions(code);
  const fsUniformValues = wgh.makeStructuredView(defs.uniforms.fsUniforms);

  const fsUniformBuffer = device.createBuffer({
    size: fsUniformValues.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 1, resource: { buffer: fsUniformBuffer } },
      { binding: 2, resource: sampler },
      { binding: 3, resource: texture.createView({ dimension: 'cube' }) },
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
  };

  const settings = {
    fov: 90,
    vertical: 0,
  };
  const gui = new GUI();
  gui.add(settings, 'fov', 1, 179);
  gui.add(settings, 'vertical', -3, 3).name('up/down');

  function render(time) {
    time *= 0.001;

    const orbitSpeed = time * 0.1;
    const radius = 20;
    const projection = mat4.perspective(settings.fov * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.5, 100);
    const eye = [Math.cos(orbitSpeed) * radius, 0, Math.sin(orbitSpeed) * radius];
    const target = [0, settings.vertical * radius, 0];
    const up = [0, 1, 0];

    const mat = fsUniformValues.views.viewDirectionProjectionInverse;
    mat4.lookAt(eye, target, up, mat);
    mat4.setTranslation(mat, [0, 0, 0], mat);
    mat4.multiply(projection, mat, mat);
    mat4.inverse(mat, mat);

    device.queue.writeBuffer(fsUniformBuffer, 0, fsUniformValues.arrayBuffer);

    const canvasTexture = context.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].view = canvasTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(3);
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
