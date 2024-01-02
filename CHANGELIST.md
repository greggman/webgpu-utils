# Change List

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




