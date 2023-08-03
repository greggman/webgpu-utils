import {
  TypedArray,
  TypedArrayConstructor,
  isTypedArray,
} from './typed-arrays.js';

const kTypedArrayToAttribFormat = new Map<TypedArrayConstructor, [string, string]>([
  [ Int8Array, ['snorm8', 'sint8' ]],
  [ Uint8Array, ['unorm8', 'uint8' ]],
  [ Int16Array, ['snorm16', 'sint16' ]],
  [ Uint16Array, ['unorm16', 'uint16' ]],
  [ Int32Array, ['sint32', 'snorm32' ]],
  [ Uint32Array, ['uint32', 'unorm32' ]],
  [ Float32Array, ['float32', 'float32' ]],
  // TODO: Add Float16Array
]);

const kVertexFormatPrefixToType = new Map<string, TypedArrayConstructor>(
  [...kTypedArrayToAttribFormat.entries()].map(([Type, [s1, s2]]) => [[s1, Type], [s2, Type]] as [[string, TypedArrayConstructor], [string, TypedArrayConstructor]]).flat()
);

export type FullArraySpec = {
  data: number[] | TypedArray,
  type?: TypedArrayConstructor,
  numComponents?: number,
  shaderLocation?: number,
  normalize?: boolean,
};

export type ArrayUnion = number[] | TypedArray | FullArraySpec;

export type Arrays = { [key: string]: ArrayUnion };
export type ArraysOptions = {
  interleave?: boolean,
  stepMode?: GPUVertexStepMode,
  usage?: GPUBufferUsageFlags,
  shaderLocation?: number,
};

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
 * 
 */
export function createVertexAttribsFromArrays(arrays: Arrays, options: ArraysOptions = {}) {
  const interleave = options.interleave === undefined ? true : options.interleave;
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
      const types = kTypedArrayToAttribFormat.get(Object.getPrototypeOf(data).constructor)!;
      const format = `${types[(array as FullArraySpec).normalize ? 1 : 0]}${numComponents > 1 ? `x${numComponents}` : ''}` as GPUVertexFormat;

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
          stepMode: 'vertex',
          arrayStride: currentOffset,
          attributes: attributes.slice(),
        });
        currentOffset = 0;
        attributes.length = 0;
      }
    });
  if (attributes.length) {
    bufferLayouts.push({
      stepMode: 'vertex',
      arrayStride: currentOffset,
      attributes: attributes,
    });
  }
  return {
    bufferLayouts,
    typedArrays,
  };
}

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
 * Given arrays, create buffers, fill the buffers with data, optionally
 * interleave the data.
 */
export function createBuffersAndAttributesFromArrays(device: GPUDevice, arrays: Arrays, options: ArraysOptions = {}) {
  const stepMode = options.stepMode || 'vertex';
  const usage = (options.usage || 0);

  const {
    bufferLayouts,
    typedArrays,
  } = createVertexAttribsFromArrays(arrays, options);

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
