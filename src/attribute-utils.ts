import {
  TypedArray,
  TypedArrayConstructor,
  isTypedArray,
} from './typed-arrays.js';

const kTypedArrayToAttribFormat = new Map<TypedArrayConstructor, {formats: [string, string], defaultForType: number}>([
  [ Int8Array,    { formats: ['sint8',   'snorm8' ], defaultForType: 1 } ],
  [ Uint8Array,   { formats: ['uint8',   'unorm8' ], defaultForType: 1 } ],
  [ Int16Array,   { formats: ['sint16',  'snorm16'], defaultForType: 1 } ],
  [ Uint16Array,  { formats: ['uint16',  'unorm16'], defaultForType: 1 } ],
  [ Int32Array,   { formats: ['sint32',  'snorm32'], defaultForType: 0 } ],
  [ Uint32Array,  { formats: ['uint32',  'unorm32'], defaultForType: 0 } ],
  [ Float32Array, { formats: ['float32', 'float32'], defaultForType: 0 } ],
  // TODO: Add Float16Array
]);

const kVertexFormatPrefixToType = new Map<string, TypedArrayConstructor>(
  [...kTypedArrayToAttribFormat.entries()].map(([Type, {formats: [s1, s2]}]) => [[s1, Type], [s2, Type]] as [[string, TypedArrayConstructor], [string, TypedArrayConstructor]]).flat()
);

/**
 * See {@link Arrays} for details
 */
export type FullArraySpec = {
  data: number[] | TypedArray,
  type?: TypedArrayConstructor,
  numComponents?: number,
  shaderLocation?: number,
  normalize?: boolean,
};

export type ArrayUnion = number[] | TypedArray | FullArraySpec;

/**
 * Named Arrays
 * 
 * A set of named arrays are passed to various functions like
 * {@link createBufferLayoutsFromArrays} and {@link createBuffersAndAttributesFromArrays}
 * 
 * Each array can be 1 of 4 things. A native JavaScript array, a TypedArray, a number, a {@link FullArraySpec}
 * 
 * If it's a native array then, if the name of the array is `indices`, `index` or `ndx` the data will be converted
 * to a `Uint32Array`, otherwise a `Float32Array.  Use a TypedArray or a FullArraySpec to choose a different type.
 * The FullArraySpec type is only used if it's not already a TypedArray
 * 
 * If it's a native array or a TypedArray or if `numComponents` in a {@link FullArraySpec} is not
 * specified it will be guess. If the name contains 'coord', 'texture' or 'uv' then numComponents will be 2.
 * If the name contains 'color' or 'colour' then numComponents will be 4. Otherwise it's 3.
 * 
 * For attribute formats, guesses are made based on type at number of components. The guess is
 * based on this table where (d) is the default for that type if `normalize` is not specified
 * 
 * | Type          |     ..      | normalize   |
 * | ------------  | ----------- | ----------- |
 * | Int8Array     | sint8       | snorm8 (d)  |
 * | Uint8Array    | uint8       | unorm8 (d)  |
 * | Int16Array    | sint16      | snorm16 (d) |
 * | Uint16Array   | uint16      | unorm16 (d) |
 * | Int32Array    | sint32 (d)  | snorm32     |
 * | Uint32Array   | uint32 (d)  | unorm32     |
 * | Float32Array  | float32 (d) | float32     |
 * 
 */
export type Arrays = { [key: string]: ArrayUnion };
export type ArraysOptions = {
  interleave?: boolean,
  stepMode?: GPUVertexStepMode,
  usage?: GPUBufferUsageFlags,
  shaderLocation?: number,
};

/**
 * Returned by {@link createBuffersAndAttributesFromArrays}
 */
export type BuffersAndAttributes = {
  numElements: number,
  bufferLayouts: GPUVertexBufferLayout[],
  buffers: GPUBuffer[],
  indexBuffer?: GPUBuffer,
  indexFormat?: GPUIndexFormat,
};

function isIndices(name: string) {
  return name === "indices" || name === 'index' || name === 'ndx';
};

function makeTypedArrayFromArrayUnion(array: ArrayUnion, name: string): TypedArray {
  if (isTypedArray(array)) {
    return array as TypedArray;
  }

  let asFullSpec = array as FullArraySpec;
  if (isTypedArray(asFullSpec.data)) {
    return asFullSpec.data as TypedArray;
  }

  if (Array.isArray(array)) {
    asFullSpec = {
      data: array,
    };
  }

  let Type = asFullSpec.type;
  if (!Type) {
    if (isIndices(name)) {
      Type = Uint32Array;
    } else {
      Type = Float32Array;
    }
  }
  return new Type(asFullSpec.data);
}

function getArray(array: ArrayUnion): number[] | TypedArray {
  const arr = (array as TypedArray).length ? array : (array as FullArraySpec).data;
  return arr as TypedArray;
}

const kNameToNumComponents = [
  { re: /coord|texture|uv/i, numComponents: 2 },
  { re: /color|colour/i, numComponents: 4 },
];

function guessNumComponentsFromNameImpl(name: string) {
  for (const {re, numComponents} of kNameToNumComponents) {
    if (re.test(name)) {
      return numComponents;
    }
  }
  return 3;
}

function guessNumComponentsFromName(name: string, length: number) {
  const numComponents = guessNumComponentsFromNameImpl(name);
  if (length % numComponents > 0) {
    throw new Error(`Can not guess numComponents for attribute '${name}'. Tried ${numComponents} but ${length} values is not evenly divisible by ${numComponents}. You should specify it.`);
  }
  return numComponents;
}

function getNumComponents(array: ArrayUnion , arrayName: string) {
  return (array as FullArraySpec).numComponents || guessNumComponentsFromName(arrayName, getArray(array).length);
}

const kVertexFormatRE = /(\w+)(?:x(\d))$/;
function numComponentsAndTypeFromVertexFormat(format: GPUVertexFormat) {
  const m = kVertexFormatRE.exec(format);
  const [prefix, numComponents] = m ? [m[1], parseInt(m[2])] : [format, 1];
  return {
    Type: kVertexFormatPrefixToType.get(prefix),
    numComponents,
  };
}

function createTypedArrayOfSameType(typedArray: TypedArray, arrayBuffer: ArrayBuffer) {
  const Ctor = Object.getPrototypeOf(typedArray).constructor;
  return new Ctor(arrayBuffer);
}

/**
 * Given a set of named arrays, generates an array `GPUBufferLayout`s
 * 
 * Examples:
 * 
 * ```js
 *   const arrays = {
 *     position: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
 *     normal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
 *     texcoord: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
 *   };
 * 
 *   const { bufferLayouts, typedArrays } = createBufferLayoutsFromArrays(arrays);
 * ```
 * 
 * results in `bufferLayouts` being
 * 
 * ```js
 * [
 *   {
 *     stepMode: 'vertex',
 *     arrayStride: 32,
 *     attributes: [
 *       { shaderLocation: 0, offset:  0, format: 'float32x3' },
 *       { shaderLocation: 1, offset: 12, format: 'float32x3' },
 *       { shaderLocation: 2, offset: 24, format: 'float32x2' },
 *     ],
 *   },
 * ]
 * ```
 * 
 * and `typedArrays` being
 * 
 * ```
 * [
 *   someFloat32Array0,
 *   someFloat32Array1,
 *   someFloat32Array2,
 * ]
 * ```
 * 
 * See {@link Arrays} for details on the various types of arrays.
 * 
 * Note: If typed arrays are passed in the same typed arrays will come out (copies will not be made)
 */
export function createBufferLayoutsFromArrays(arrays: Arrays, options: ArraysOptions = {}) {
  const interleave = options.interleave === undefined ? true : options.interleave;
  const stepMode = options.stepMode || 'vertex';
  const shaderLocations: number[] = options.shaderLocation
     ? (Array.isArray(options.shaderLocation) ? options.shaderLocation : [options.shaderLocation])
     : [0];
  let currentOffset = 0;
  const bufferLayouts: GPUVertexBufferLayout[] = [];
  const attributes: GPUVertexAttribute[] = [];
  const typedArrays: TypedArray[] = [];
  Object.keys(arrays)
    .filter(arrayName => !isIndices(arrayName))
    .forEach(arrayName => {
      const array = arrays[arrayName];
      const data = makeTypedArrayFromArrayUnion(array, arrayName);
      const numComponents = getNumComponents(array, arrayName);
      const offset = currentOffset;
      currentOffset += numComponents * data.BYTES_PER_ELEMENT;
      const { defaultForType, formats } = kTypedArrayToAttribFormat.get(Object.getPrototypeOf(data).constructor)!;
      const normalize = (array as FullArraySpec).normalize;
      const formatNdx = typeof normalize === 'undefined' ? defaultForType : (normalize ? 1 : 0);
      const format = `${formats[formatNdx]}${numComponents > 1 ? `x${numComponents}` : ''}` as GPUVertexFormat;

      // TODO: cleanup with generator?
      const shaderLocation = shaderLocations.shift()!;
      if (shaderLocations.length === 0) {
        shaderLocations.push(shaderLocation + 1);
      }
      attributes.push({
        offset,
        format,
        shaderLocation,
      });
      typedArrays.push(data);
      if (!interleave) {
        bufferLayouts.push({
          stepMode,
          arrayStride: currentOffset,
          attributes: attributes.slice(),
        });
        currentOffset = 0;
        attributes.length = 0;
      }
    });
  if (attributes.length) {
    bufferLayouts.push({
      stepMode,
      arrayStride: currentOffset,
      attributes: attributes,
    });
  }
  return {
    bufferLayouts,
    typedArrays,
  };
}

/**
 * Given an array of `GPUVertexAttribute`s and a corresponding array
 * of TypedArrays, interleaves the contents of the typed arrays
 * into the given ArrayBuffer
 * 
 * example:
 * 
 * ```js
 * const attributes: GPUVertexAttribute[] = [
 *   { shaderLocation: 0, offset:  0, format: 'float32x3' },
 *   { shaderLocation: 1, offset: 12, format: 'float32x3' },
 *   { shaderLocation: 2, offset: 24, format: 'float32x2' },
 * ];
 * const typedArrays = [
 *   new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]),
 *   new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
 *   new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]),
 * ];
 * const arrayStride = (3 + 3 + 2) * 4;  // pos + nrm + uv
 * const arrayBuffer = new ArrayBuffer(arrayStride * 24)
 * interleaveVertexData(attributes, typedArrays, arrayStride, arrayBuffer)
 * ```
 * 
 * results in the contents of `arrayBuffer` to be the 3 TypedArrays interleaved
 * 
 * See {@link Arrays} for details on the various types of arrays.
 *
 * Note: You can generate `attributes` and `typedArrays` above by calling
 * {@link createBufferLayoutsFromArrays}
 */
export function interleaveVertexData(
    attributes: GPUVertexAttribute[],
    typedArrays: TypedArray[],
    arrayStride: number,
    arrayBuffer: ArrayBuffer,
) {
  const views = new Map<TypedArrayConstructor, TypedArray>();
  const getView = (typedArray: TypedArray) => {
    const ctor = Object.getPrototypeOf(typedArray).constructor;
    const view = views.get(ctor);
    if (view) {
      return view;
    }
    const newView = new ctor(arrayBuffer);
    views.set(ctor, newView);
    return newView;
  };

  attributes.forEach((attribute, ndx) => {
    const { offset, format } = attribute;
    const { numComponents } = numComponentsAndTypeFromVertexFormat(format);
    const data = typedArrays[ndx];
    const view = getView(data);
    for (let i = 0; i < data.length; i += numComponents) {
      const ndx = i / numComponents;
      const dstOffset = (offset + ndx * arrayStride) / view.BYTES_PER_ELEMENT
      const s = data.subarray(i, i + numComponents);
      view.set(s, dstOffset);
    }
  });
}

/**
 * Given arrays, create buffers, fills the buffers with data if provided, optionally
 * interleaves the data (the default).
 *
 * Example:
 * 
 * ```js
 *  const {
 *    buffers,
 *    bufferLayouts,
 *    indexBuffer,
 *    indexFormat,
 *    numElements,
 *  } = createBuffersAndAttributesFromArrays(device, {
 *    position: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
 *    normal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
 *    texcoord: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
 *    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
 *  });
 * ```
 * 
 * Where `bufferLayouts` will be
 * 
 * ```js
 * [
 *   {
 *     stepMode: 'vertex',
 *     arrayStride: 32,
 *     attributes: [
 *       { shaderLocation: 0, offset:  0, format: 'float32x3' },
 *       { shaderLocation: 1, offset: 12, format: 'float32x3' },
 *       { shaderLocation: 2, offset: 24, format: 'float32x2' },
 *     ],
 *   },
 * ]
 * ```
 *
 * * `buffers` will have one `GPUBuffer` of usage `GPUBufferUsage.VERTEX`
 * * `indexBuffer` will be `GPUBuffer` of usage `GPUBufferUsage.INDEX`
 * * `indexFormat` will be `uint32` (use a full spec or a typedarray of `Uint16Array` if you want 16bit indices)
 * * `numElements` will be 36 (this is either the number entries in the array named `indices`, `index` or `ndx` or if no
 *    indices are provided then it's the length of the first array divided by numComponents. See {@link Arrays})
 * 
 * See {@link Arrays} for details on the various types of arrays.
 * Also see the cube and instancing examples.
 */
export function createBuffersAndAttributesFromArrays(device: GPUDevice, arrays: Arrays, options: ArraysOptions = {}) {
  const usage = (options.usage || 0);

  const {
    bufferLayouts,
    typedArrays,
  } = createBufferLayoutsFromArrays(arrays, options);

  const buffers = [];
  let numElements = -1;
  let bufferNdx = 0;
  for (const {attributes, arrayStride} of bufferLayouts) {
    const attribs = attributes as GPUVertexAttribute[];
    const attrib0 = attribs[0];
    const data0 = typedArrays[bufferNdx];
    const {numComponents} = numComponentsAndTypeFromVertexFormat(attrib0.format);
    if (numElements < 0) {
      numElements = data0.length / numComponents;
    }

    const size = arrayStride * numElements;
    const buffer = device.createBuffer({
      usage: usage | GPUBufferUsage.VERTEX,
      size,
      mappedAtCreation: true,
    });

    const arrayBuffer = buffer.getMappedRange();
    if (attribs.length === 1 && arrayStride === data0.BYTES_PER_ELEMENT * numComponents) {
      const view = createTypedArrayOfSameType(data0, arrayBuffer);
      view.set(data0);
    } else {
      interleaveVertexData(attribs, typedArrays.slice(bufferNdx), arrayStride, arrayBuffer);
    }
    buffer.unmap();
    buffers.push(buffer);
    bufferNdx += attribs.length;
  }

  const buffersAndAttributes: BuffersAndAttributes = {
    numElements,
    bufferLayouts,
    buffers,
  };

  const indicesEntry = Object.entries(arrays).find(([arrayName]) => isIndices(arrayName));
  if (indicesEntry) {
    const indices = makeTypedArrayFromArrayUnion(indicesEntry[1], 'indices');
    const indexBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | usage,
      mappedAtCreation: true,
    });
    const dst = createTypedArrayOfSameType(indices, indexBuffer.getMappedRange());
    dst.set(indices);
    indexBuffer.unmap();

    buffersAndAttributes.indexBuffer = indexBuffer;
    buffersAndAttributes.indexFormat = indices instanceof Uint16Array ? 'uint16' : 'uint32';
    buffersAndAttributes.numElements = indices.length;
  }

  return buffersAndAttributes;
}
