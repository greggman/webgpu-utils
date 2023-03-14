import { WgslReflect, Member } from './3rdParty/wgsl_reflect/wgsl_reflect.module';

export const roundUpToMultipleOf = (v: number, multiple: number) => (((v + multiple - 1) / multiple) | 0) * multiple;

// TODO: fix better?
export const isTypedArray = (arr: any) =>
    arr && typeof arr.length === 'number' && arr.buffer instanceof ArrayBuffer && typeof arr.byteLength === 'number';

export type TypedArrayConstructor =
    | Int8ArrayConstructor
    | Uint8ArrayConstructor
    | Int16ArrayConstructor
    | Uint16ArrayConstructor
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Float32ArrayConstructor
    | Float64ArrayConstructor;

export type TypedArray =
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;

export class TypedArrayViewGenerator {
    arrayBuffer: ArrayBuffer;
    byteOffset: number;

    constructor(sizeInBytes: number) {
        this.arrayBuffer = new ArrayBuffer(sizeInBytes);
        this.byteOffset = 0;
    }
    align(alignment: number) {
        this.byteOffset = roundUpToMultipleOf(this.byteOffset, alignment);
    }
    pad(numBytes: number) {
        this.byteOffset += numBytes;
    }
    getView<T extends TypedArray>(Ctor: TypedArrayConstructor, numElements: number): T {
        const view = new Ctor(this.arrayBuffer, this.byteOffset, numElements);
        this.byteOffset += view.byteLength;
        return view as T;
    }
}

export interface StructDefinition {
    fields: FieldDefinitions;
    size: number;
}

export interface StorageDefinition extends StructDefinition {
    binding: number;
    group: number;
}

export type IntrinsicDefinition = {
    offset: number;
    size: number;
    type: string;
    numElements?: number;
};

export type FieldDefinition = IntrinsicDefinition | StructDefinition | IntrinsicDefinition[] | StructDefinition[];

export type FieldDefinitions = {
    [x: string]: FieldDefinition;
};


type TypeDef = {
    numElements: number;
    align: number;
    size: number;
    type: string;
    View: TypedArrayConstructor;
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
  mat2x2f: { numElements:  8, align:  8, size: 16, type: 'f32', View: Float32Array },
  mat2x2h: { numElements:  4, align:  4, size:  8, type: 'u16', View: Uint16Array },
  mat3x2f: { numElements:  8, align:  8, size: 24, type: 'f32', View: Float32Array },
  mat3x2h: { numElements:  8, align:  4, size: 12, type: 'u16', View: Uint16Array },
  mat4x2f: { numElements:  8, align:  8, size: 32, type: 'f32', View: Float32Array },
  mat4x2h: { numElements:  8, align:  4, size: 16, type: 'u16', View: Uint16Array },
  mat2x3f: { numElements: 12, align: 16, size: 32, type: 'f32', View: Float32Array },
  mat2x3h: { numElements: 12, align:  8, size: 16, type: 'u16', View: Uint16Array },
  mat3x3f: { numElements: 12, align: 16, size: 48, type: 'f32', View: Float32Array },
  mat3x3h: { numElements: 12, align:  8, size: 24, type: 'u16', View: Uint16Array },
  mat4x3f: { numElements: 16, align: 16, size: 64, type: 'f32', View: Float32Array },
  mat4x3h: { numElements: 16, align:  8, size: 32, type: 'u16', View: Uint16Array },
  mat2x4f: { numElements: 16, align: 16, size: 32, type: 'f32', View: Float32Array },
  mat2x4h: { numElements: 16, align:  8, size: 16, type: 'u16', View: Uint16Array },
  mat3x4f: { numElements: 16, align: 16, size: 48, type: 'f32', View: Float32Array },
  mat3x4h: { numElements: 16, align:  8, size: 24, type: 'u16', View: Uint16Array },
  mat4x4f: { numElements: 16, align: 16, size: 64, type: 'f32', View: Float32Array },
  mat4x4h: { numElements: 16, align:  8, size: 32, type: 'u16', View: Uint16Array },
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

/**
 * Creates a set of named TypedArray views on an ArrayBuffer
 * @param structDef Definition of the various types of views.
 * @param arrayBuffer Optional ArrayBuffer to use (if one provided one will be created)
 * @param offset Optional offset in existing ArrayBuffer to start the views.
 * @returns A bunch of named TypedArray views and the ArrayBuffer
 */
export function makeTypedArrayViews(structDef: StructDefinition, arrayBuffer?: ArrayBuffer, offset?: number): ArrayBufferViews {
    const baseOffset = offset || 0;
    const buffer = arrayBuffer || new ArrayBuffer(structDef.size);

    const makeViews = (structDef: FieldDefinition): TypedArrayOrViews => {
        if (Array.isArray(structDef)) {
            return (structDef as StructDefinition[]).map(elemDef => makeViews(elemDef)) as Views[];
        } else if (typeof structDef === 'string') {
            throw Error('unreachable');
        } else {
            const fields = (structDef as StructDefinition).fields;
            if (fields) {
                const views: Views = {};
                for (const [name, def] of Object.entries(fields)) {
                    views[name] = makeViews(def as StructDefinition);
                }
                return views;
            } else {
                const { size, offset, type } = structDef as IntrinsicDefinition;
              try {
                const { View } = typeInfo[type];
                const numElements = size / View.BYTES_PER_ELEMENT;
                return new View(buffer, baseOffset + offset, numElements);
              } catch {
                throw new Error(`unknown type: ${type}`);
              }
            }
        }
    };
    return { views: makeViews(structDef), arrayBuffer: buffer };
}

/**
 * Given a set of TypeArrayViews and matching JavaScript data
 * sets the content of the views.
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
            view.set(data as number[]);
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
 * Given a StructDefinition, create matching TypedArray views
 * @param structDef A StructDefinition as returned from {@link makeShaderDataDefinitions}
 * @param arrayBuffer Optional ArrayBuffer for the views
 * @param offset Optional offset into the ArrayBuffer for the views
 * @returns TypedArray views for the various named fields of the structure as well
 *    as a `set` function to make them easy to set, and the arrayBuffer
 */
export function makeStructuredView(structDef: StructDefinition, arrayBuffer?: ArrayBuffer, offset = 0): StructuredView {
    const views = makeTypedArrayViews(structDef, arrayBuffer, offset);
    return {
        ...views,
        set(data: any) {
            setStructuredView(data, views.views);
        },
    };
}

function addMember(reflect: WgslReflect, m: Member, offset: number): [string, StructDefinition | IntrinsicDefinition | IntrinsicDefinition[] | StructDefinition[]] {
    if (m.isArray) {
        if (m.isStruct) {
            return [
                m.name,
                new Array(m.arrayCount).fill(0).map((_, ndx) => {
                    return addMembers(reflect, m.members!, m.size / m.arrayCount, offset + (m.offset || 0) + m.size / m.arrayCount * ndx);
                }),
            ];
        } else {
            return [
                m.name,
                {
                    offset: offset + (m.offset || 0),
                    size: m.size,
                    type: m.type.format!.format
                        ? `${m.type.format!.name!}<${m.type.format!.format!.name}>`
                        : m.type.format!.name!,
                    numElements: m.arrayCount,
                },
            ];
        }
    } else if (m.isStruct) {
        return [
            m.name,
            addMembers(reflect, m.members!, m.size, offset + (m.offset || 0)),
        ];
    } else {
        return [
            m.name,
            {
                offset: offset + (m.offset || 0),
                size: m.size,
                type: m.type?.format
                    ? `${m.type.name}<${m.type.format.name}>`
                    : m.type?.name || m.name,
            },
        ];
    }
}

function addMembers(reflect: WgslReflect, members: Member[], size: number, offset = 0): StructDefinition {
    const fields: FieldDefinitions = Object.fromEntries(members.map(m => {
        return addMember(reflect, m, offset);
    }));

    return {
        fields,
        size,
    };
}

export type StructDefinitions = {
    [x: string]: StructDefinition;
}

export type StorageDefinitions = {
    [x: string]: StorageDefinition;
}

type ShaderDataDefinitions = {
    uniforms: StorageDefinitions,
    storages: StorageDefinitions,
    structs: StructDefinitions,
};

/**
 * Given a WGSL shader, returns data definitions for structures,
 * uniforms, and storage buffers
 *
 * Example:
 *
 * ```js
 * const code = `
 * struct MyStruct {
 *    color: vec4<f32>,
 *    brightness: f32,
 *    kernel: array<f32, 9>,
 * };
 * @group(0) @binding(0) var<uniform> myUniforms: MyUniforms;
 * `;
 * const defs = makeShaderDataDefinitions(code);
 * const myUniformValues = makeStructuredView(defs.uniforms.myUniforms);
 *
 * myUniformValues.set({
 *   color: [1, 0, 1, 1],
 *   brightness: 0.8,
 *   kernel: [
 *      1, 0, -1,
 *      2, 0, -2,
 *      1, 0, -1,
 *   ],
 * });
 * device.queue.writeBuffer(uniformBuffer, 0, myUniformValues.arrayBuffer);
 * ```
 *
 * @param code WGSL shader. Note: it is not required for this to be a complete shader
 * @returns definitions of the structures by name. Useful for passing to {@link makeStructuredView}
 */
export function makeShaderDataDefinitions(code: string): ShaderDataDefinitions {
    const reflect = new WgslReflect(code);

    const structs = Object.fromEntries(reflect.structs.map(struct => {
        const info = reflect.getStructInfo(struct);
        return [struct.name, addMembers(reflect, info.members, info.size)];
    }));

    const uniforms = Object.fromEntries(reflect.uniforms.map(uniform => {
        const info = reflect.getUniformBufferInfo(uniform);
        const member = addMember(reflect, info, 0)[1] as StorageDefinition;
        member.binding = info.binding;
        member.group = info.group;
        return [uniform.name, member];
    }));

    const storages = Object.fromEntries(reflect.storage.map(uniform => {
        const info = reflect.getStorageBufferInfo(uniform);
        const member = addMember(reflect, info, 0)[1] as StorageDefinition;
        member.binding = info.binding;
        member.group = info.group;
        return [uniform.name, member];
    }));

    return {
        structs,
        storages,
        uniforms,
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

export function setStructuredValues(fieldDef: FieldDefinition, data: any, arrayBuffer: ArrayBuffer, offset = 0) {
    const asIntrinsicDefinition = fieldDef as IntrinsicDefinition;
    if (asIntrinsicDefinition.type) {
        const type = typeInfo[asIntrinsicDefinition.type];
        const view = getView(arrayBuffer, type.View);
        const index = (offset + asIntrinsicDefinition.offset) / view.BYTES_PER_ELEMENT;
        if (typeof data === 'number') {
            view[index] = data;
        } else {
            view.set(data, index);
        }
    } else if (Array.isArray(fieldDef)) {
        // It's IntrinsicDefinition[] or StructDefinition[]
        data.forEach((newValue: any, ndx: number) => {
            setStructuredValues(fieldDef[ndx], newValue, arrayBuffer, offset);
        });
    } else {
        // It's StructDefinition
        const asStructDefinition = fieldDef as StructDefinition;
        for (const [key, newValue] of Object.entries(data)) {
            const fieldDef = asStructDefinition.fields[key];
            if (fieldDef) {
                setStructuredValues(fieldDef, newValue, arrayBuffer, offset);
            }
        }
    }
}