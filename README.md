# webgpu-utils

[![NPM Package][npm]][npm-url]

## [Docs](docs)

## Random useful things for WebGPU

As I do more WebGPU I find I need more and more helpers to make things
less tedious. These are the result. I expect I'll add more over time.

## Create easy to set uniform `ArrayBuffer` views.

Example:

```js
import {
  makeStructuredDescriptions,
  makeStructuredView,
} from 'webgpu-utils';

const code = `
struct MyUniforms {
   color: vec4<f32>,
   brightness: f32,
   kernel: array<f32, 9>,
};
@group(0) @binding(0) var<uniform> myUniforms: MyUniforms;
`;

const descriptions = makeUniformDescriptions(code);
const myUniformValues = makeStructuredView(descriptions['myUniforms']);

myUniformValues.set({
  color: [1, 0, 1, 1],
  brightness: 0.8,
  kernel: [
     1, 0, -1,
     2, 0, -2,
     1, 0, -1,
  ],
});
device.queue.writeBuffer(uniformBuffer, 0, myUniformValues.arrayBuffer);
```

## License

[MIT](LICENSE.md)

