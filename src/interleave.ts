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

export type BufferInfo = {
  numElements: number,
  bufferLayout: GPUVertexBufferLayout,
  buffer: GPUBuffer,
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
      Type = Uint16Array;
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

function createTypedArrayOfSameType(typedArray: TypedArray, arrayBuffer: ArrayBuffer) {
  const Ctor = Object.getPrototypeOf(typedArray).constructor;
  return new Ctor(arrayBuffer);
}

export function normalizeArray(srcMin: number, srcMax: number, dstMin: number, dstMax: number, array: number[] | TypedArray) {
  const srcRange = srcMax - srcMin;
  const dstRange = dstMax - dstMin
  return array.map(v => (v - srcMin) / srcRange * dstRange + dstMin);
}

/**
 * Given arrays, create buffers, fill the buffers with data, optionally
 * interleave the data.
 * @param arrays 
 * @param options 
 */
export function createBufferInfoFromArrays(device: GPUDevice, arrays: Arrays, options: ArraysOptions = {}) {
  const stepMode = options.stepMode || 'vertex';
  const interleave = options.interleave === undefined ? true : options.interleave;
  const usage = (options.usage || 0);
  const shaderLocations: number[] = options.shaderLocation
     ? (Array.isArray(options.shaderLocation) ? options.shaderLocation : [options.shaderLocation])
     : [0];
  let currentOffset = 0;
  let indices;
  const attribs: {attribute: GPUVertexAttribute, data: TypedArray, numComponents: number }[] = [];
  Object.keys(arrays)
    .forEach(function(arrayName) {
      const array = arrays[arrayName];
      if (isIndices(arrayName)) {
        indices = array;
        return;
      }
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
      attribs.push({
        attribute: {
          offset,
          format,
          shaderLocation,
        },
        data,
        numComponents,  // should we derive from format?
      });
    });

  const arrayStride = currentOffset;
  const numElements = attribs[0].data.length / attribs[0].numComponents;

  const size = arrayStride * numElements;
  const buffer = device.createBuffer({
    usage: usage | GPUBufferUsage.VERTEX,
    size,
    mappedAtCreation: true,
  });

  const arrayBuffer = buffer.getMappedRange();

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

  const attributes = attribs.map(({attribute, data, numComponents}) => {
    const { offset } =  attribute;
    const view = getView(data);
    for (let i = 0; i < data.length; i += numComponents) {
      const ndx = i / numComponents;
      const dstOffset = (offset + ndx * arrayStride) / view.BYTES_PER_ELEMENT
      const s = data.subarray(i, i + numComponents);
      view.set(s, dstOffset);
    }

    return attribute;
  });

  buffer.unmap();

  const bufferLayout: GPUVertexBufferLayout = {
    stepMode,
    arrayStride,
    attributes,
  };

  const bufferInfo: BufferInfo = {
    numElements,
    bufferLayout,
    buffer,
  };

  if (indices) {
    indices = makeTypedArrayFromArrayUnion({data: indices, type: Uint32Array, numComponents: 1}, 'indices');
    const indexBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | usage,
      mappedAtCreation: true,
    });
    const dst = createTypedArrayOfSameType(indices, indexBuffer.getMappedRange());
    dst.set(indices);
    indexBuffer.unmap();

    bufferInfo.indexBuffer = indexBuffer;
    bufferInfo.indexFormat = indices instanceof Uint16Array ? 'uint16' : 'uint32';
    bufferInfo.numElements = indices.length;
  }


  return bufferInfo;
}
