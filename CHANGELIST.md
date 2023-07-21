# Change List

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




