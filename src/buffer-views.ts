import {
    IntrinsicDefinition,
    StructDefinition,
    ArrayDefinition,
    TypeDefinition,
    VariableDefinition,
} from './data-definitions.js';
import {
    isTypedArray,
    TypedArrayConstructor,
    TypedArray,
} from './typed-arrays.js';
import { roundUpToMultipleOf } from './utils.js';

type TypeDef = {
    numElements: number;
    align: number;
    size: number;
    type: string;
    View: TypedArrayConstructor;
    pad?: number[];
};

const b: Record<string, TypeDef> = {
  i32: { numElements: 1, align: 4, size: 4, type: 'i32', View: Int32Array },
  u32: { numElements: 1, align: 4, size: 4, type: 'u32', View: Uint32Array },
  f32: { numElements: 1, align: 4, size: 4, type: 'f32', View: Float32Array },
  f16: { numElements: 1, align: 2, size: 2, type: 'u16', View: Uint16Array },

  vec2f: { numElements: 2, align:  8, size:  8, type: 'f32', View: Float32Array },
  vec2i: { numElements: 2, align:  8, size:  8, type: 'i32', View: Int32Array },
  vec2u: { numElements: 2, align:  8, size:  8, type: 'u32', View: Uint32Array },
  vec2h: { numElements: 2, align:  4, size:  4, type: 'u16', View: Uint16Array },
  vec3i: { numElements: 3, align: 16, size: 12, type: 'i32', View: Int32Array },
  vec3u: { numElements: 3, align: 16, size: 12, type: 'u32', View: Uint32Array },
  vec3f: { numElements: 3, align: 16, size: 12, type: 'f32', View: Float32Array },
  vec3h: { numElements: 3, align:  8, size:  6, type: 'u16', View: Uint16Array },
  vec4i: { numElements: 4, align: 16, size: 16, type: 'i32', View: Int32Array },
  vec4u: { numElements: 4, align: 16, size: 16, type: 'u32', View: Uint32Array },
  vec4f: { numElements: 4, align: 16, size: 16, type: 'f32', View: Float32Array },
  vec4h: { numElements: 4, align:  8, size:  8, type: 'u16', View: Uint16Array },

  // AlignOf(vecR)	SizeOf(array<vecR, C>)
  mat2x2f: { numElements:  4, align:  8, size: 16,              type: 'f32', View: Float32Array },
  mat2x2h: { numElements:  4, align:  4, size:  8,              type: 'u16', View: Uint16Array },
  mat3x2f: { numElements:  6, align:  8, size: 24,              type: 'f32', View: Float32Array },
  mat3x2h: { numElements:  6, align:  4, size: 12,              type: 'u16', View: Uint16Array },
  mat4x2f: { numElements:  8, align:  8, size: 32,              type: 'f32', View: Float32Array },
  mat4x2h: { numElements:  8, align:  4, size: 16,              type: 'u16', View: Uint16Array },
  mat2x3f: { numElements:  8, align: 16, size: 32, pad: [3, 1], type: 'f32', View: Float32Array },
  mat2x3h: { numElements:  8, align:  8, size: 16, pad: [3, 1], type: 'u16', View: Uint16Array },
  mat3x3f: { numElements: 12, align: 16, size: 48, pad: [3, 1], type: 'f32', View: Float32Array },
  mat3x3h: { numElements: 12, align:  8, size: 24, pad: [3, 1], type: 'u16', View: Uint16Array },
  mat4x3f: { numElements: 16, align: 16, size: 64, pad: [3, 1], type: 'f32', View: Float32Array },
  mat4x3h: { numElements: 16, align:  8, size: 32, pad: [3, 1], type: 'u16', View: Uint16Array },
  mat2x4f: { numElements:  8, align: 16, size: 32,              type: 'f32', View: Float32Array },
  mat2x4h: { numElements:  8, align:  8, size: 16,              type: 'u16', View: Uint16Array },
  mat3x4f: { numElements: 12, align: 16, size: 48, pad: [3, 1], type: 'f32', View: Float32Array },
  mat3x4h: { numElements: 12, align:  8, size: 24, pad: [3, 1], type: 'u16', View: Uint16Array },
  mat4x4f: { numElements: 16, align: 16, size: 64,              type: 'f32', View: Float32Array },
  mat4x4h: { numElements: 16, align:  8, size: 32,              type: 'u16', View: Uint16Array },
};

const typeInfo: Record<string, TypeDef> = {
  ...b,

  'vec2<i32>': b.vec2f,
  'vec2<u32>': b.vec2i,
  'vec2<f32>': b.vec2u,
  'vec2<f16>': b.vec2h,
  'vec3<i32>': b.vec3i,
  'vec3<u32>': b.vec3u,
  'vec3<f32>': b.vec3f,
  'vec3<f16>': b.vec3h,
  'vec4<i32>': b.vec4i,
  'vec4<u32>': b.vec4u,
  'vec4<f32>': b.vec4f,
  'vec4<f16>': b.vec4h,

  'mat2x2<f32>': b.mat2x2f,
  'mat2x2<f16>': b.mat2x2h,
  'mat3x2<f32>': b.mat3x2f,
  'mat3x2<f16>': b.mat3x2h,
  'mat4x2<f32>': b.mat4x2f,
  'mat4x2<f16>': b.mat4x2h,
  'mat2x3<f32>': b.mat2x3f,
  'mat2x3<f16>': b.mat2x3h,
  'mat3x3<f32>': b.mat3x3f,
  'mat3x3<f16>': b.mat3x3h,
  'mat4x3<f32>': b.mat4x3f,
  'mat4x3<f16>': b.mat4x3h,
  'mat2x4<f32>': b.mat2x4f,
  'mat2x4<f16>': b.mat2x4h,
  'mat3x4<f32>': b.mat3x4f,
  'mat3x4<f16>': b.mat3x4h,
  'mat4x4<f32>': b.mat4x4f,
  'mat4x4<f16>': b.mat4x4h,
};

export type TypedArrayOrViews = TypedArray | Views | Views[];
export interface Views {
  [x: string]: TypedArrayOrViews;
}
export type ArrayBufferViews = {
    views: TypedArrayOrViews;
    arrayBuffer: ArrayBuffer;
}

// This needs to be fixed! 😱
function getSizeOfTypeDef(typeDef: TypeDefinition): number {
  const asArrayDef = typeDef as ArrayDefinition;
  const elementType = asArrayDef.elementType;
  if (elementType) {
    return asArrayDef.size;
    /*
    if (isIntrinsic(elementType)) {
        const asIntrinsicDef = elementType as IntrinsicDefinition;
        const { align } = typeInfo[asIntrinsicDef.type];
        return roundUpToMultipleOf(typeDef.size, align) * asArrayDef.numElements;
    } else {
        return asArrayDef.numElements * getSizeOfTypeDef(elementType);
    }
    */
  } else {
    const asStructDef = typeDef as StructDefinition;
    const numElements = asArrayDef.numElements || 1;
    if (asStructDef.fields) {
        return typeDef.size * numElements;
    } else {
        const asIntrinsicDef = typeDef as IntrinsicDefinition;
        const { align } = typeInfo[asIntrinsicDef.type];
        return numElements > 1
           ? roundUpToMultipleOf(typeDef.size, align) * numElements
           : typeDef.size;
    }
  }
}

function range<T>(count: number, fn: (i: number) => T) {
    return new Array(count).fill(0).map((_, i) => fn(i));
}

// If numElements is undefined this is NOT an array. If it is defined then it IS an array
// Sizes for arrays are different than sizes for non-arrays. Example
// a vec3f non array is Float32Array(3)
// a vec3f array of 2 is Float32Array(4 * 2)
// a vec3f array of 1 is Float32Array(4 * 1)
function makeIntrinsicTypedArrayView(typeDef: TypeDefinition, buffer: ArrayBuffer, baseOffset: number, numElements?: number): TypedArray {
    const { size, type } = typeDef as IntrinsicDefinition;
    try {
        const { View, align } = typeInfo[type];
        const isArray = numElements !== undefined;
        const sizeInBytes = isArray
            ? roundUpToMultipleOf(size, align)
            : size;
        const baseNumElements = sizeInBytes / View.BYTES_PER_ELEMENT;
        const effectiveNumElements = isArray
           ? (numElements === 0
              ? (buffer.byteLength - baseOffset) / sizeInBytes
              : numElements)
           : 1;

        return new View(buffer, baseOffset, baseNumElements * effectiveNumElements);
    } catch {
        throw new Error(`unknown type: ${type}`);
    }

}

function isIntrinsic(typeDef: TypeDefinition) {
    return !(typeDef as StructDefinition).fields &&
           !(typeDef as ArrayDefinition).elementType;
}

/**
 * Creates a set of named TypedArray views on an ArrayBuffer. If you don't
 * pass in an ArrayBuffer, one will be created. If you're using an unsized
 * array then you must pass in your own arraybuffer
 *
 * Example:
 *
 * ```js
 * const code = `
 * struct Stuff {
 *    direction: vec3f,
 *    strength: f32,
 *    matrix: mat4x4f,
 * };
 * @group(0) @binding(0) var<uniform> uni: Stuff;
 * `;
 * const defs = makeShaderDataDefinitions(code);
 * const views = makeTypedArrayViews(devs.uniforms.uni.typeDefinition);
 * ```
 *
 * views would effectively be
 *
 * ```js
 * views = {
 *   direction: Float32Array(arrayBuffer, 0, 3),
 *   strength: Float32Array(arrayBuffer, 3, 4),
 *   matrix: Float32Array(arraybuffer, 4, 20),
 * };
 * ```
 *
 * You can use the views directly or you can use @link {setStructuredView}
 *
 * @param typeDef Definition of the various types of views.
 * @param arrayBuffer Optional ArrayBuffer to use (if one provided one will be created)
 * @param offset Optional offset in existing ArrayBuffer to start the views.
 * @returns A bunch of named TypedArray views and the ArrayBuffer
 */
export function makeTypedArrayViews(typeDef: TypeDefinition, arrayBuffer?: ArrayBuffer, offset?: number): ArrayBufferViews {
    const baseOffset = offset || 0;
    const buffer = arrayBuffer || new ArrayBuffer(getSizeOfTypeDef(typeDef));

    const makeViews = (typeDef: TypeDefinition, baseOffset: number): TypedArrayOrViews => {
        const asArrayDef = typeDef as ArrayDefinition;
        const elementType = asArrayDef.elementType;
        if (elementType) {
            // TODO: Should be optional? Per Type? Depth set? Per field?
            // The issue is, if we have `array<vec4, 1000>` we don't likely
            // want 1000 `Float32Array(4)` views. We want 1 `Float32Array(1000 * 4)` view.
            // On the other hand, if we have `array<mat4x4, 10>` the maybe we do want
            // 10 `Float32Array(16)` views since you might want to do
            // `mat4.perspective(fov, aspect, near, far, foo.bar.arrayOf10Mat4s[3])`;
            if (isIntrinsic(elementType)) {
                return makeIntrinsicTypedArrayView(elementType, buffer, baseOffset, asArrayDef.numElements);
            } else {
                const elementSize = getSizeOfTypeDef(elementType);
                const effectiveNumElements = asArrayDef.numElements === 0
                   ? (buffer.byteLength - baseOffset) / elementSize
                   : asArrayDef.numElements;
                return range(effectiveNumElements, i => makeViews(elementType, baseOffset + elementSize * i)) as Views[];
            }
        } else if (typeof typeDef === 'string') {
            throw Error('unreachable');
        } else {
            const fields = (typeDef as StructDefinition).fields;
            if (fields) {
                const views: Views = {};
                for (const [name, {type, offset}] of Object.entries(fields)) {
                    views[name] = makeViews(type, baseOffset + offset);
                }
                return views;
            } else {
                return makeIntrinsicTypedArrayView(typeDef, buffer, baseOffset);
            }
        }
    };
    return { views: makeViews(typeDef, baseOffset), arrayBuffer: buffer };
}

/**
 * Given a set of TypeArrayViews and matching JavaScript data
 * sets the content of the views.
 *
 * Example:
 *
 * ```js
 * const code = `
 * struct Stuff {
 *    direction: vec3f,
 *    strength: f32,
 *    matrix: mat4x4f,
 * };
 * @group(0) @binding(0) var<uniform> uni: Stuff;
 * `;
 * const defs = makeShaderDataDefinitions(code);
 * const views = makeTypedArrayViews(devs.uniforms.uni.typeDefinition);
 *
 * setStructuredViews({
 *   direction: [1, 2, 3],
 *   strength: 45,
 *   matrix: [
 *     1, 0, 0, 0,
 *     0, 1, 0, 0,
 *     0, 0, 1, 0,
 *     0, 0, 0, 1,
 *   ],
 * });
 * ```
 *
 * The code above will set the various views, which all point to different
 * locations within the same array buffer.
 *
 * See @link {makeTypedArrayViews}.
 *
 * @param data The new values
 * @param views TypedArray views as returned from {@link makeTypedArrayViews}
 */
export function setStructuredView(data: any, views: TypedArrayOrViews): void {
    if (data === undefined) {
        return;
    } else if (isTypedArray(views)) {
        const view = views as TypedArray;
        if (view.length === 1 && typeof data === 'number') {
            view[0] = data;
        } else {
            if (Array.isArray(data[0]) || isTypedArray(data[0])) {
                // complete hack!
                // there's no type data here so let's guess based on the user's data
                const dataLen = data[0].length;
                const stride = dataLen === 3 ? 4 : dataLen;
                for (let i = 0; i < data.length; ++i) {
                    const offset = i * stride;
                    view.set(data[i], offset);
                }
            } else {
                view.set(data as number[]);
            }
        }
    } else if (Array.isArray(views)) {
        const asArray = views as Views[];
        (data as any[]).forEach((newValue, ndx) => {
            setStructuredView(newValue, asArray[ndx]);
        });
    } else {
        const asViews = views as Views;
        for (const [key, newValue] of Object.entries(data)) {
            const view = asViews[key];
            if (view) {
                setStructuredView(newValue, view);
            }
        }
    }
}

export type StructuredView = ArrayBufferViews & {
    /**
     * Sets the contents of the TypedArrays based on the data passed in
     * Note: The data may be sparse
     *
     * example:
     *
     * ```js
     * const code = `
     * struct HSL {
     *   hue: f32,
     *   sat: f32,
     *   lum: f32,
     * };
     * struct MyUniforms {
     *    colors: array<HSL, 4>,
     *    brightness: f32,
     *    kernel: array<f32, 9>,
     * };
     * @group(0) @binding(0) var<uniform> myUniforms: MyUniforms;
     * `;
     * const defs = makeShaderDataDefinitions(code);
     * const myUniformValues = makeStructuredView(defs.uniforms.myUniforms);
     *
     * myUniformValues.set({
     *   colors: [
     *     ,
     *     ,
     *     { hue: 0.5, sat: 1.0, lum: 0.5 },  // only set the 3rd color
     *   ],
     *   brightness: 0.8,
     *   kernel: [
     *      1, 0, -1,
     *      2, 0, -2,
     *      1, 0, -1,
     *   ],
     * });
     * ```
     *
     * @param data
     */
    set(data: any): void;
}

/**
 * Given a VariableDefinition, create matching TypedArray views
 * @param varDef A VariableDefinition as returned from {@link makeShaderDataDefinitions}
 * @param arrayBuffer Optional ArrayBuffer for the views
 * @param offset Optional offset into the ArrayBuffer for the views
 * @returns TypedArray views for the various named fields of the structure as well
 *    as a `set` function to make them easy to set, and the arrayBuffer
 */
export function makeStructuredView(varDef: VariableDefinition | StructDefinition, arrayBuffer?: ArrayBuffer, offset = 0): StructuredView {
    const asVarDef = varDef as VariableDefinition;
    const typeDef = asVarDef.group === undefined ? varDef as StructDefinition : asVarDef.typeDefinition;
    const views = makeTypedArrayViews(typeDef, arrayBuffer, offset);
    return {
        ...views,
        set(data: any) {
            setStructuredView(data, views.views);
        },
    };
}

type ViewsByCtor = Map<TypedArrayConstructor, TypedArray>;
const s_views = new WeakMap<ArrayBuffer, ViewsByCtor>();

function getViewsByCtor(arrayBuffer: ArrayBuffer): ViewsByCtor {
    let viewsByCtor = s_views.get(arrayBuffer);
    if (!viewsByCtor) {
        viewsByCtor = new Map();
        s_views.set(arrayBuffer, viewsByCtor);
    }
    return viewsByCtor;
}

function getView<T extends TypedArray>(arrayBuffer: ArrayBuffer, Ctor: TypedArrayConstructor): T {
    const viewsByCtor = getViewsByCtor(arrayBuffer);
    let view = viewsByCtor.get(Ctor);
    if (!view) {
        view = new Ctor(arrayBuffer);
        viewsByCtor.set(Ctor, view);
    }
    return view as T;
}

// Is this something like [1,2,3]?
function isArrayLikeOfNumber(data: any) {
    return isTypedArray(data) || Array.isArray(data) && typeof data[0] === 'number';
}

function setIntrinsicFromArrayLikeOfNumber(typeDef: IntrinsicDefinition, data: any, arrayBuffer: ArrayBuffer, offset: number) {
    const asIntrinsicDefinition = typeDef as IntrinsicDefinition;
    const type = typeInfo[asIntrinsicDefinition.type];
    const view = getView(arrayBuffer, type.View);
    const index = offset / view.BYTES_PER_ELEMENT;
    if (typeof data === 'number') {
        view[index] = data;
    } else {
        view.set(data, index);
    }
}

/**
 * Sets values on an existing array buffer from a TypeDefinition
 * @param typeDef A type definition provided by @link {makeShaderDataDefinitions}
 * @param data The source data
 * @param arrayBuffer The arrayBuffer who's data to set.
 * @param offset An offset in the arrayBuffer to start at.
 */
export function setTypedValues(typeDef: TypeDefinition, data: any, arrayBuffer: ArrayBuffer, offset = 0) {
    const asArrayDef = typeDef as ArrayDefinition;
    const elementType = asArrayDef.elementType;
    if (elementType) {
        // It's ArrayDefinition
        if (isIntrinsic(elementType)) {
            const asIntrinsicDef = elementType as IntrinsicDefinition;
            if (isArrayLikeOfNumber(data)) {
                setIntrinsicFromArrayLikeOfNumber(asIntrinsicDef, data, arrayBuffer, offset);
                return;
            }
        }
        data.forEach((newValue: any, ndx: number) => {
            setTypedValues(elementType, newValue, arrayBuffer, offset + elementType.size * ndx);
        });
        return;
    }

    const asStructDef = typeDef as StructDefinition;
    const fields = asStructDef.fields;
    if (fields) {
        // It's StructDefinition
        for (const [key, newValue] of Object.entries(data)) {
            const fieldDef = fields[key];
            if (fieldDef) {
                setTypedValues(fieldDef.type, newValue, arrayBuffer, offset + fieldDef.offset);
            }
        }
    } else {
        // It's IntrinsicDefinition
        setIntrinsicFromArrayLikeOfNumber(typeDef as IntrinsicDefinition, data, arrayBuffer, offset);
    }
}

/**
 * Same as @link {setTypedValues} except it takes a @link {VariableDefinition}.
 * @param typeDef A variable definition provided by @link {makeShaderDataDefinitions}
 * @param data The source data
 * @param arrayBuffer The arrayBuffer who's data to set.
 * @param offset An offset in the arrayBuffer to start at.
 */
export function setStructuredValues(varDef: VariableDefinition, data: any, arrayBuffer: ArrayBuffer, offset = 0) {
    setTypedValues(varDef.typeDefinition, data, arrayBuffer, offset);
}