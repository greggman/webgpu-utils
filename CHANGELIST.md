# Change List

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




