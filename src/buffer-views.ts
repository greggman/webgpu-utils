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
import { roundUpToMultipleOf, range } from './utils.js';
import {
    WGSLType,
    kWGSLTypes,
    kWGSLTypeInfo,
} from './wgsl-types.js';

/**
 * Set which intrinsic types to make views for.
 *
 * Example:
 *
 * Given a an array of intrinsics like this
 * `array<vec3, 200>`
 *
 * The default is to create a single `Float32Array(4 * 200)`
 * because creating 200 `Float32Array` views is not usually
 * what you want.
 *
 * If you do want individual views then you'd call
 * `setIntrinsicsToView(['vec3f'])` and now you get
 * an array of 200 `Float32Array`s.
 *
 * Note: `setIntrinsicsToView` always sets ALL types. The list you
 * pass it is the types you want views created for, all other types
 * will be reset to do the default. In other words
 *
 * ```js
 * setIntrinsicsToView(['vec3f'])
 * setIntrinsicsToView(['vec2f'])
 * ```
 *
 * Only `vec2f` will have views created. `vec3f` has been reset to the default by
 * the second call
 *
 * You can pass in `true` as the 2nd parameter to make it set which types
 * to flatten and all others will be set to have views created. For example
 * to expand all types would be `setIntrinsicsToView([], true)`. To expand
 * all except `f32` would be `setIntrinsicsToView(['f32'], true)`.
 *
 * To reset all types to the default call it with no arguments
 *
 * @param types array of types to make views for
 * @param flatten whether to flatten or expand the specified types.
 */
export function setIntrinsicsToView(types: readonly WGSLType[] = [], flatten?: boolean) {
    // we need to track what we've viewed because for example `vec3f` references
    // the same info as `vec3<f32>` so we'd set one and reset the other.
    const visited = new Set();
    for (const type of kWGSLTypes) {
        const info = kWGSLTypeInfo[type];
        if (!visited.has(info)) {
            visited.add(info);
            info.flatten = types.includes(type) ? flatten : !flatten;
        }
    }
}
setIntrinsicsToView();

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
            const { align } = kWGSLTypeInfo[asIntrinsicDef.type];
            return numElements > 1
                ? roundUpToMultipleOf(typeDef.size, align) * numElements
                : typeDef.size;
        }
    }
}

// If numElements is undefined this is NOT an array. If it is defined then it IS an array
// Sizes for arrays are different than sizes for non-arrays. Example
// a vec3f non array is Float32Array(3)
// a vec3f array of 2 is Float32Array(4 * 2)
// a vec3f array of 1 is Float32Array(4 * 1)
function makeIntrinsicTypedArrayView(typeDef: TypeDefinition, buffer: ArrayBuffer, baseOffset: number, numElements?: number): TypedArray {
    const { size, type } = typeDef as IntrinsicDefinition;
    try {
        const { View, align } = kWGSLTypeInfo[type];
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
            if (isIntrinsic(elementType) && kWGSLTypeInfo[(elementType as IntrinsicDefinition).type].flatten) {
                return makeIntrinsicTypedArrayView(elementType, buffer, baseOffset, asArrayDef.numElements);
            } else {
                const {size} = getSizeAndAlignmentOfUnsizedArrayElementOfTypeDef(typeDef);
                const effectiveNumElements = asArrayDef.numElements === 0
                   ? (buffer.byteLength - baseOffset) / size
                   : asArrayDef.numElements;
                return range(effectiveNumElements, i => makeViews(elementType, baseOffset + size * i)) as Views[];
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
    const type = kWGSLTypeInfo[asIntrinsicDefinition.type];
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
 * @param varDef A variable definition provided by @link {makeShaderDataDefinitions}
 * @param data The source data
 * @param arrayBuffer The arrayBuffer who's data to set.
 * @param offset An offset in the arrayBuffer to start at.
 */
export function setStructuredValues(varDef: VariableDefinition, data: any, arrayBuffer: ArrayBuffer, offset = 0) {
    setTypedValues(varDef.typeDefinition, data, arrayBuffer, offset);
}

function getAlignmentOfTypeDef(typeDef: TypeDefinition): number {
    const asArrayDef = typeDef as ArrayDefinition;
    const elementType = asArrayDef.elementType;
    if (elementType) {
        return getAlignmentOfTypeDef(elementType);
    }

    const asStructDef = typeDef as StructDefinition;
    const fields = asStructDef.fields;
    if (fields) {
        return Object.values(fields).reduce((max, {type}) => Math.max(max, getAlignmentOfTypeDef(type)), 0);
    }

    const { type } = typeDef as IntrinsicDefinition;
    const { align } = kWGSLTypeInfo[type];
    return align;
}

type ElementInfo = {
    unalignedSize: number,
    align: number,
    size: number,
};

function getSizeAndAlignmentOfUnsizedArrayElementOfTypeDef(typeDef: TypeDefinition): ElementInfo {
    const asArrayDef = typeDef as ArrayDefinition;
    const elementType = asArrayDef.elementType;
    if (elementType) {
        const unalignedSize = elementType.size;
        const align = getAlignmentOfTypeDef(elementType);
        return {
            unalignedSize,
            align,
            size: roundUpToMultipleOf(unalignedSize, align),
        };
    }

    const asStructDef = typeDef as StructDefinition;
    const fields = asStructDef.fields;
    if (fields) {
        const lastField = Object.values(fields).pop()!;
        if (lastField.type.size === 0) {
            return getSizeAndAlignmentOfUnsizedArrayElementOfTypeDef(lastField.type);
        }
    }

    return {
        size: 0,
        unalignedSize: 0,
        align: 1,
    };
}

/**
 * Returns the size, align, and unalignedSize of "the" unsized array element. Unsized arrays are only
 * allowed at the outer most level or the last member of a top level struct.
 *
 * Example:
 *
 * ```js
 * const code = `
 * struct Foo {
 *   a: u32,
 *   b: array<vec3f>,
 * };
 * @group(0) @binding(0) var<storage> f: Foo;
 * `;
 * const defs = makeShaderDataDefinitions(code);
 * const { size, align, unalignedSize } = getSizeAndAlignmentOfUnsizedArrayElement(
 *    defs.storages.f);
 * // size = 16   (since you need to allocate 16 bytes per element)
 * // align = 16  (since vec3f needs to be aligned to 16 bytes)
 * // unalignedSize = 12 (since only 12 bytes are used for a vec3f)
 * ```
 *
 * Generally you only need size. Example:
 *
 * ```js
 * const code = `
 * struct Foo {
 *   a: u32,
 *   b: array<vec3f>,
 * };
 * @group(0) @binding(0) var<storage> f: Foo;
 * `;
 * const defs = makeShaderDataDefinitions(code);
 * const { size } = getSizeAndAlignmentOfUnsizedArrayElement(defs.storages.f);
 * const numElements = 10;
 * const views = makeStructuredViews(
 *    defs.storages.f,
 *    new ArrayBuffer(defs.storages.f.size + size * numElements));
 * ```
 *
 * @param varDef A variable definition provided by @link {makeShaderDataDefinitions}
 * @returns the size, align, and unalignedSize in bytes of the unsized array element in this type definition.
 *   If there is no unsized array, size = 0.
 */
export function getSizeAndAlignmentOfUnsizedArrayElement(varDef: VariableDefinition | StructDefinition): {size: number, align: number} {
    const asVarDef = varDef as VariableDefinition;
    const typeDef = asVarDef.group === undefined ? varDef as StructDefinition : asVarDef.typeDefinition;
    return getSizeAndAlignmentOfUnsizedArrayElementOfTypeDef(typeDef);
}
