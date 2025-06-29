# Change List

### 1.11.0

* Switch to undefined bindGroupLayouts instead of empty bindGroupLayouts

### 1.10.3

* Fix so can use in worker

### 1.10.1

* Fix so `@size` doesn't increase size of intrinsic view.

### 1.10.0

* Support compatibility mode - eg mip generation

### 1.9.0

* Support `minBindingSize` in bind group layouts.

### 1.8.0

* Support creating 3d textures from images/canvases...

### 1.7.0

* Add `primitives.deindex`
* Add `primitives.generateTriangleNormals`

### 1.6.0

* Export `ShaderDataDefinitions`

### 1.5.1

* handle empty bind groups.

### 1.5.0

* Add support for storage textures, external textures, and samplers

### 1.4.0

* Support `atomic`

### 1.3.0

* Add `makeBindGroupLayoutDescriptors`

### 1.2.0

* Add `getSizeOfUnsizedArrayElement`

### 1.1.0

* Make `generateMipmap` support compatibility mode

### 1.0.0

* switch primitive functions to use named parameters.

### 0.15.0

* add `setIntrinsicsToView`

### 0.14.3

* Fixes for vec2 typos

### 0.14.2

* Handle bool issue fix

### 0.14.0

* Use latest wgsl_reflect

### 0.13.0

* Support making views of unsized arrays

### 0.12.0

* Use newer version of wgsl_reflect and handle arrays of arrays

### 0.11.0

* Add primitives

### 0.10.0

* Add instancing support

### 0.9.0

* Change `createBufferInfoFromArrays` to `createBuffersAndAttributesFromArrays`

### 0.8.0

* Add (alpha version) of `createBufferInfoFromArrays`

### 0.7.0

* Support for multiple sources for layers
* Generate mips for layers

### 0.6.0

* Support typedArrays and native arrays via `copySourceToTexture`
  and `createTextureFromSource`

### 0.5.0

* Add 'premultipliedAlpha' and 'colorSpace' texture options
  to `copySourceToTexture`

### 0.4.3

* try changing type of `ArrayBufferViews.views` to `any` because
  otherwise it's too cumbersome to use in TypeScript.

### 0.4.2

* Update wgsl_reflect to handle `array` constructor
* Add docs

### 0.3.0

* Add support for setting arrays as arrays
* add texture related functions

  * `generateMipmap`
  * `copySourceToTexture`
  * `getSizeFromSource`
  * `createTextureFromSource`
  * `createTextureFromImage`
  * `numMipLevels`
  * `normalizeGPUExtent3D`




