# webgpu-utils

![](https://img.shields.io/npm/v/webgpu-utils)

## Docs

See [here](https://greggman.github.io/webgpu-utils/docs)

* [ChangeList](https://greggman.github.io/webgpu-utils/CHANGELIST.html)
* [Migration Notes](https://greggman.github.io/webgpu-utils/migration.html)

## Random useful things for WebGPU

As I do more WebGPU I find I need more and more helpers to make things
less tedious. These are the result. I expect I'll add more over time.

### Easily set Uniforms (based on your WGSL structs/types)

Example:

```js
import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from 'webgpu-utils';

const code = `
struct MyUniforms {
   color: vec4f,
   brightness: f32,
   kernel: array<f32, 9>,
   projectionMatrix: mat4x4f,
};
@group(0) @binding(0) var<uniform> myUniforms: MyUniforms;
`;

const defs = makeShaderDataDefinitions(code);
const myUniformValues = makeStructuredView(defs.uniforms.myUniforms);

// create the correct sized buffer
const uniformBuffer = device.createBuffer({
  size: myUniformValues.arrayBuffer.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

// Set some values via set
myUniformValues.set({
  color: [1, 0, 1, 1],
  brightness: 0.8,
  kernel: [
     1, 0, -1,
     2, 0, -2,
     1, 0, -1,
  ],
});

// Set a value by passing it to a math library
mat4.perspective(
    degToRad(45),
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    20,
    myUniformValues.views.projectionMatrix);

// Upload the data to the GPU
device.queue.writeBuffer(uniformBuffer, 0, myUniformValues.arrayBuffer);
```

See [makeStructuredView](https://greggman.github.io/webgpu-utils/docs/functions/makeStructuredView.html) for details.

### Load an image URL as a texture (with mips)

```js
import { createTextureFromImage } from 'webgpu-utils';

const texture = await createTextureFromImage(device, 'https://someimage.url', {
  mips: true,
  flipY: true,
});
```

### Load a canvas/video/ImageBitmap as a texture (with mips)

```js
import { createTextureFromSource } from 'webgpu-utils';

const texture = createTextureFromSource(device, someCanvasVideoImageBitmap, {
  mips: true,
  flipY: true,
});
```

### Load 6 images as a cubemap (with mips)

```js
import { createTextureFromImage } from 'webgpu-utils';

const texture = await createTextureFromImages(device, [
  'images/yokohama/posx.jpg',
  'images/yokohama/negx.jpg',
  'images/yokohama/posy.jpg',
  'images/yokohama/negy.jpg',
  'images/yokohama/posz.jpg',
  'images/yokohama/negz.jpg',
], {
  mips: true,
});
```

### Load data as a texture

```js
import { createTextureFromSource } from 'webgpu-utils';

const r = [255,   0,   0, 255];
const g = [  0, 255,   0, 255];
const b = [  0,   0, 255, 255];
const y = [255, 255,   0, 255];

// if no width or height is passed, then assumes data is rgba8unorm
// if sqrt(numPixels) is in then makes a square. Otherwise Nx1
const data2x2 = [ r, g, b, y ].flat();
const texture2x2 = createTextureFromSource(device, data2x2, {
  mips: true,
});
```

```js
const data4x1 = {
  data: [ r, g, b, y ].flat();
  width: 4,
};
const texture4x1 = createTextureFromSource(device, data4x1, {
  mips: true,
});
```

```js
const singlePixelWhiteTexture = createTextureFromSource(
    device, [255, 255, 255, 255]);
```

```js
const rg16sint2x2 = [
  1,2  3,4,
  5,6, 7,8,
];
const rg16Texture2x2 = createTextureFromSource(
  device, rg16sint2x2, { format: 'rg16sint' });
```

All data above can be a TypedArray

```js
const singlePixelRedTexture = createTextureFromSource(
    device, new Uint8Array[255, 0, 0, 255]);
```

### Generate mips on an existing texture

```js
import { numMipLevels, generateMipmap } from 'webgpu-utils';

const size = [8, 8, 1];
const texture = device.createTexture({
  size,
  mipLevelCount: numMipLevels(size);
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
});

... do whatever you do to fill out the mip level 0 ...

generateMipmap(device, texture);
```

### Create Buffers and attributes (interleaved)

```js
import { numMipLevels, generateMipmap } from 'webgpu-utils';

const bi = wgh.createBuffersAndAttributesFromArrays(device, {
  position: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
  normal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
  texcoord: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
  indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
});

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
    entryPoint: 'myVSMain',
    buffers: bi.bufferLayouts,  // <---
  },
  ...
});

// at render time
passEncoder.setVertexBuffer(0, bi.buffers[0]);
passEncoder.setIndexBuffer(bi.indexBuffer, bi.indexFormat);
passEncoder.drawIndexed(bi.numElements);
```

### Create `GPUBindGroupLayoutDescriptors` from WGSL code

```js
import {
  makeShaderDataDefinitions,
  makeBindGroupLayoutDescriptors,
} from 'webgpu-utils';

const code = `
@group(0) @binding(0) var<uniform> mat: mat4x4f;

struct MyVSOutput {
  @builtin(position) position: vec4f,
  @location(1) texcoord: vec2f,
};

@vertex
fn myVSMain(v: MyVSInput) -> MyVSOutput {
  var vsOut: MyVSOutput;
  vsOut.position = mat * v.position;
  vsOut.texcoord = v.texcoord;
  return vsOut;
}

@group(0) @binding(2) var diffuseSampler: sampler;
@group(0) @binding(3) var diffuseTexture: texture_2d<f32>;

@fragment
fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
  return textureSample(diffuseTexture, diffuseSampler, v.texcoord);
}
`;

const module = device.createShaderModule({code});
const defs = wgh.makeShaderDataDefinitions(code);

const pipelineDesc = {
  vertex: {
    module,
    entryPoint: 'myVSMain',
    buffers: bufferLayouts,
  },
  fragment: {
    module,
    entryPoint: 'myFSMain',
    targets: [
      {format: presentationFormat},
    ],
  },
};

const descriptors = wgh.makeBindGroupLayoutDescriptors(defs, pipelineDesc);
const group0Layout = device.createBindGroupLayout(descriptors[0]);
const layout = device.createPipelineLayout({
  bindGroupLayouts: [group0Layout],
});
const pipeline = device.createRenderPipeline({
  layout,
  ...pipelineDesc,
});
```

## Examples:

* [Cube](examples/cube.html)
* [2d-array](examples/cube.html)
* [Cube-map](examples/cube-map.html)
* [Instancing](examples/instancing.html)
* [Instancing 2](examples/instancing-size-only.html)

## Notes about structured data

### The first level of an array of intrinsic types is flattened by default.

Example:

```js
const code = `
@group(0) @binding(0) var<uniform> uni1: array<vec3f, 4>;
@group(0) @binding(1) var<uniform> uni2: array<array<vec3f, 3>, 4>;
`;
const defs = makeShaderDataDefinitions(code);
const uni1 = makeStructuredView(defs.uniforms.uni1);
const uni2 = makeStructuredView(defs.uniforms.uni2);

uni1.set([
  1, 2, 3, 0,  // uni1[0]
  4, 5, 6, 0,  // uni1[1]
  //...
]);

uni2.set([
  [
    1, 2, 3, 0,  // uni2[0][0],
    4, 5, 6, 0,  // uni2[0][1],
  ],
  ,  // uni2[1]
  [
    7, 8, 9, 0,  // uni2[2][0],
    4, 5, 6, 0,  // uni2[2][1],
  ],
]);
```

The reason it's this way is it's common to make large arrays of `f32`, `u32`,
`vec2f`, `vec3f`, `vec4f` etc. We wouldn't want every element of an array to
have its own typedarray view.

You can configure this per type by calling `setIntrinsicsToView`.
The configuration is global. Given th example above

```js
const code = `
@group(0) @binding(0) var<uniform> uni1: array<vec3f, 4>;
@group(0) @binding(1) var<uniform> uni2: array<array<vec3f, 3>, 4>;
`;
const defs = makeShaderDataDefinitions(code);
setIntrinsicsToView(['vec3f']);
const uni1 = makeStructuredView(defs.uniforms.uni1);

uni1.set([
  [1, 2, 3],  // uni1[0]
  [4, 5, 6],  // uni1[1]
  ...
]);
```

Or to put it another way, in the default case, `uni1.views is a Float32Array(16)`.
In the 2nd case it's an array of 4 `Float32Array` each 3 elements big

### arrays of intrinsics can be set by arrays of arrays

```js
const code = `
@group(0) @binding(0) var<uniform> uni1: array<vec2f, 4>;
`;
const defs = makeShaderDataDefinitions(code);
const uni1 = makeStructuredView(defs.uniforms.uni1);

uni1.set([
  [1, 2],  // uni1[0]
  [3, 4],  // uni1[1]
]);
```

Currently this requires the length of each subarray to match the length of
the intrinsic. The reason being, there is no type data used in `uni1.set` so
there is nothing to tell it that it's a `vec2f`. In this case, it just advances
where it's writing by the length of the source data sub arrays.

### for unsized arrays you must pass in your own arrayBuffer

The reason is an unsized array's size is defined to WebGPU by its buffer binding
size. That information is provided at runtime so there's no way for webgpu-utils
to know the size. The solution is you pass in an `ArrayBuffer`.

Example:

```js
const code = `
@group(0) @binding(0) var<storage> buf1: array<vec3f>;  // unsized array
`;
const defs = makeShaderDataDefinitions(code);
const buf1 = makeStructuredView(defs.storages.buf1, new ArrayBuffer(4 * 16));

// buf1.views will be a Float32Array representing 4 vec3fs
```

Note: If you have a complex array element type you can call
`getSizeAndAlignmentOfUnsizedArrayElement` to get its size. Example:

```js
const code = `
struct Light {
  intensity: f32,
  direction: vec3f,
};
@group(0) @binding(7) var<storage> lights: array<Light>;
`;
const defs = makeShaderDataDefinitions(code);
const {size} = getSizeAndAlignmentOfUnsizedArrayElement(defs.storages.lights);
const numLights = 4;
const buf1 = makeStructuredView(
    defs.storages.lights, new ArrayBuffer(numLights * size));
```

Similarly if you are using an unsized array as the last member of a struct
you might do this

```js
const code = `
struct Kernel {
  amount: f32,
  entries: array<vec3f>,
};
@group(0) @binding(7) var<storage> conv: Kernel;
`;
const defs = makeShaderDataDefinitions(code);
const {size: elemSize} = getSizeAndAlignmentOfUnsizedArrayElement(defs.storages.conv);
const numKernelEntries = 4;
const size = defs.storages.conv.size + numKernelEntries * elemSize;
const buf1 = makeStructuredView(
    defs.storages.conv, new ArrayBuffer(size));
)
```

## Usage

* include from the net

```js
import { createTextureFromImage } from 'https://greggman.github.io/webgpu-utils/dist/2.x/webgpu-utils.module.js'

...
```

* [Live Example 1](https://jsgist.org/?src=30dfc8cb81777219dd9e91d9471452d0)

* npm

```sh
npm install webgpu-utils
```

```js
import { createTextureFromImage } from 'webgpu-utils';

...
```

## <a id="examples"></a> Examples

* [2d-array texture](examples/2d-array.html)
* [cube](examples/cube.html)
* [cube-map](examples/cube-map.html)
* [instancing](examples/instancing.html)
* [primitives](examples/primitives.html)
* [reverse-z](examples/reverse-z.html)
* [stencil](examples/stencil.html)
* [stencil-cube](examples/stencil-cube.html)

## Development

```
git clone https://github.com/greggman/webgpu-utils.git
cd webgpu-utils
npm ci
npm start
```

This will run rollup in watch mode, building from typescript into
`dist/2.x/webgpu-utils.js` and start a server

Now open [`http://localhost:8080/test/`](http://localhost:8080/test/) to run tests.

## Thanks

Super thanks to Brendan Duncan for [wgsl-reflect](https://github.com/brendan-duncan/wgsl_reflect) on which much of this is based.

## License

[MIT](LICENSE.md)
