# webgpu-utils

![](https://img.shields.io/npm/v/webgpu-utils)

## Docs

See [here](https://greggman.github.io/webgpu-utils/docs)

## Random useful things for WebGPU

As I do more WebGPU I find I need more and more helpers to make things
less tedious. These are the result. I expect I'll add more over time.

Note: At the moment, minified and gzipped this is only 9k! It's also
possible to tree shake so you'll only get what you use.

### Easily set Uniforms (based on your WGSL structs/types)

Example:

```js
import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from 'webgpu-utils';

const code = `
struct MyUniforms {
   color: vec4<f32>,
   brightness: f32,
   kernel: array<f32, 9>,
   projectionMatrix: mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> myUniforms: MyUniforms;
`;

const defs = makeShaderDataDefinitions(code);
const myUniformValues = makeStructuredView(defs.uniforms.myUniforms);

// create the correct sized buffer
const uniformBuffer = device.createBuffer({
  size: myUniformBuffer.arrayBuffer.byteLength,
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

[Live Example]

### Load an image URL as a texture (with mips)

```js
import { createTextureFromImage } from 'webgpu-utils';

const texture = await createTextureFromImage(device, 'https://someimage.url', {
  mips: true,
  flipY: true,
});
```

### Load a canvas as a texture (with mips)

```js
import { createTextureFromSource } from 'webgpu-utils';

const texture = createTextureFromSource(device, someCanvas, {
  mips: true,
  flipY: true,
});
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

## Usage

* include from the net

```js
import { createTextureFromImage } from 'https://greggman.github.io/webgpu-utils/dist/0.x/webgpu-utils.module.js'

...
```

* npm

```sh
npm install webgpu-utils
```

```js
import { createTextureFromImage } from 'webgpu-utils';

...
```

## Development

```
git clone https://github.com/greggman/webgpu-utils.git
cd webgpu-utils
npm install
npm start
```

This will run rollup in watch mode, building from typescript into
`dist/0.x/webgpu-utils.js`.

```
npx servez
```

Now open [`http://localhost:8080/test/`](http://localhost:8080/test/) to run tests.

## Thanks

Super thanks to Brendan Duncan for [wgsl-reflect](https://github.com/brendan-duncan/wgsl_reflect) on which much of this is based.

## License

[MIT](LICENSE.md)

