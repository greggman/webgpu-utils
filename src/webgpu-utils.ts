import { WgslReflect, StructInfo, UniformBufferInfo, Member } from './3rdParty/wgsl_reflect/wgsl_reflect.module';

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
};
export type FieldDefinition = {
    offset: number;
    size: number;
    type: string;
    numElements?: number;
};
export type FieldDefinitions = {
    [x: string]: FieldDefinition | StructDefinition | FieldDefinition[] | StructDefinition[];
};

type TypeDef = {
    numElements: number;
    align: number;
    size: number;
    type: string;
    view: TypedArrayConstructor;
};

const typeInfo: Record<string, TypeDef> = {
    i32: { numElements: 1, align: 4, size: 4, type: 'i32', view: Int32Array },
    u32: { numElements: 1, align: 4, size: 4, type: 'u32', view: Uint32Array },
    f32: { numElements: 1, align: 4, size: 4, type: 'f32', view: Float32Array },
    f16: { numElements: 1, align: 2, size: 2, type: 'u16', view: Uint16Array },
    'vec2<i32>': { numElements: 2, align:  8, size:  8, type: 'i32', view: Int32Array },
    'vec2<u32>': { numElements: 2, align:  8, size:  8, type: 'u32', view: Uint32Array },
    'vec2<f32>': { numElements: 2, align:  8, size:  8, type: 'f32', view: Float32Array },
    'vec2': { numElements: 2, align:  8, size:  8, type: 'f32', view: Float32Array },
    'vec2<f16>': { numElements: 2, align:  4, size:  4, type: 'u16', view: Uint16Array },
    'vec3<i32>': { numElements: 3, align: 16, size: 12, type: 'i32', view: Int32Array },
    'vec3<u32>': { numElements: 3, align: 16, size: 12, type: 'u32', view: Uint32Array },
    'vec3<f32>': { numElements: 3, align: 16, size: 12, type: 'f32', view: Float32Array },
    'vec3': { numElements: 3, align: 16, size: 12, type: 'f32', view: Float32Array },
    'vec3<f16>': { numElements: 3, align:  8, size:  6, type: 'u16', view: Uint16Array },
    'vec4<i32>': { numElements: 4, align: 16, size: 16, type: 'i32', view: Int32Array },
    'vec4<u32>': { numElements: 4, align: 16, size: 16, type: 'u32', view: Uint32Array },
    'vec4<f32>': { numElements: 4, align: 16, size: 16, type: 'f32', view: Float32Array },
    'vec4': { numElements: 4, align: 16, size: 16, type: 'f32', view: Float32Array },
    'vec4<f16>': { numElements: 4, align:  8, size:  8, type: 'u16', view: Uint16Array },
    // AlignOf(vecR)	SizeOf(array<vecR, C>)
    'mat2x2<f32>': { numElements:  8, align:  8, size: 16, type: 'f32', view: Float32Array },
    'mat2x2': { numElements:  8, align:  8, size: 16, type: 'f32', view: Float32Array },
    'mat2x2<f16>': { numElements:  4, align:  4, size:  8, type: 'u16', view: Uint16Array },
    'mat3x2<f32>': { numElements:  8, align:  8, size: 24, type: 'f32', view: Float32Array },
    'mat3x2': { numElements:  8, align:  8, size: 24, type: 'f32', view: Float32Array },
    'mat3x2<f16>': { numElements:  8, align:  4, size: 12, type: 'u16', view: Uint16Array },
    'mat4x2<f32>': { numElements:  8, align:  8, size: 32, type: 'f32', view: Float32Array },
    'mat4x2': { numElements:  8, align:  8, size: 32, type: 'f32', view: Float32Array },
    'mat4x2<f16>': { numElements:  8, align:  4, size: 16, type: 'u16', view: Uint16Array },
    'mat2x3<f32>': { numElements: 12, align: 16, size: 32, type: 'f32', view: Float32Array },
    'mat2x3': { numElements: 12, align: 16, size: 32, type: 'f32', view: Float32Array },
    'mat2x3<f16>': { numElements: 12, align:  8, size: 16, type: 'u16', view: Uint16Array },
    'mat3x3<f32>': { numElements: 12, align: 16, size: 48, type: 'f32', view: Float32Array },
    'mat3x3': { numElements: 12, align: 16, size: 48, type: 'f32', view: Float32Array },
    'mat3x3<f16>': { numElements: 12, align:  8, size: 24, type: 'u16', view: Uint16Array },
    'mat4x3<f32>': { numElements: 16, align: 16, size: 64, type: 'f32', view: Float32Array },
    'mat4x3': { numElements: 16, align: 16, size: 64, type: 'f32', view: Float32Array },
    'mat4x3<f16>': { numElements: 16, align:  8, size: 32, type: 'u16', view: Uint16Array },
    'mat2x4<f32>': { numElements: 16, align: 16, size: 32, type: 'f32', view: Float32Array },
    'mat2x4': { numElements: 16, align: 16, size: 32, type: 'f32', view: Float32Array },
    'mat2x4<f16>': { numElements: 16, align:  8, size: 16, type: 'u16', view: Uint16Array },
    'mat3x4<f32>': { numElements: 16, align: 16, size: 48, type: 'f32', view: Float32Array },
    'mat3x4': { numElements: 16, align: 16, size: 48, type: 'f32', view: Float32Array },
    'mat3x4<f16>': { numElements: 16, align:  8, size: 24, type: 'u16', view: Uint16Array },
    'mat4x4<f32>': { numElements: 16, align: 16, size: 64, type: 'f32', view: Float32Array },
    'mat4x4': { numElements: 16, align: 16, size: 64, type: 'f32', view: Float32Array },
    'mat4x4<f16>': { numElements: 16, align:  8, size: 32, type: 'u16', view: Uint16Array },
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

    const makeViews = (structDef: StructDefinition): TypedArrayOrViews => {
        if (Array.isArray(structDef)) {
            return (structDef as StructDefinition[]).map(elemDef => makeViews(elemDef)) as Views[];
        } else if (typeof structDef === 'string') {
            throw Error('unreachable');
        } else {
            const views: Views = {};
            for (const [name, def] of Object.entries(structDef.fields)) {
                const { size, offset, type } = def as FieldDefinition;
                if (typeof type === 'string') {
                    const { view } = typeInfo[type];
                    const numElements = size / view.BYTES_PER_ELEMENT;
                    views[name] = new view(buffer, baseOffset + offset, numElements);
                } else {
                    views[name] = makeViews(def as StructDefinition);
                }
            }
            return views;
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
     * const defs = makeUniformDefinitions(code);
     * const myUniformValues = makeStructuredView(defs.myUniforms);
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
 * @param structDef A StructDefinition as returned from {@link makeStructureDefinitions} or {@link makeUniformDefinitions}
 * @param arrayBuffer Optional ArrayBuffer for the views
 * @param offset Optional offset into the ArrayBuffer for the views
 * @returns TypedArray views for the various named fields of the structure as well
 *    as a `set` function to make them easy to set, and the arrayBuffer
 */
export function makeStructuredView(structDef: StructDefinition, arrayBuffer?: ArrayBuffer, offset?: number): StructuredView {
    const views = makeTypedArrayViews(structDef, arrayBuffer, offset);
    return {
        ...views,
        set(data: any) {
            setStructuredView(data, views.views);
        },
    };
}

export type StructDefinitions = {
    [x: string]: StructDefinition;
}

function addMembers(reflect: WgslReflect, members: Member[], size: number, offset: number = 0): StructDefinition {
    const fields: FieldDefinitions = Object.fromEntries(members.map(m => {
        if (m.isArray) {
            if (m.isStruct) {
                return [
                    m.name,
                    new Array(m.arrayCount).fill(0).map((_, ndx) => {
                        return addMembers(reflect, m.members!, m.structSize!, offset + m.offset + m.structSize! * ndx)
                    }),
                ];
            } else {
                return [
                    m.name,
                    {
                        offset: offset + m.offset,
                        size: m.size,
                        type: m.type.format!.name!,
                        numElements: m.arrayCount,
                    }
                ]
            }
        } else if (m.isStruct) {
            return [
                m.name,
                addMembers(reflect, m.members!, m.size, offset + m.offset),
            ];
        } else {
            return [
                m.name,
                {
                    offset: offset + m.offset,
                    size: m.size,
                    type: m.type.name!,
                },
            ];
        }
    }));

    return {
        fields,
        size,
    };
}

/**
 * Given a WGSL shader, returns structure definitions by structure name
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
 * `;
 * const defs = makeStructureDefinitions(code);
 * const myStructValues = makeStructuredView(defs.MyStruct);
 * 
 * myStructValues.set({
 *   color: [1, 0, 1, 1],
 *   brightness: 0.8,
 *   kernel: [
 *      1, 0, -1,
 *      2, 0, -2,
 *      1, 0, -1,
 *   ],
 * });
 * 
 * console.log(myStructValues.arrayBuffer);
 * ```
 * 
 * @param code WGSL shader. Note: it is not required for this to be a complete shader
 * @returns definitions of the structures by name. Useful for passing to {@link makeStructuredView}
 */
export function makeStructureDefinitions(code: string): StructDefinitions {
    const reflect = new WgslReflect(code);

    return Object.fromEntries(reflect.structs.map(struct => {
        const info = reflect.getStructInfo(struct);
        return [struct.name, addMembers(reflect, info.members, info.size)];
    }));
}

/**
 * Given a WGSL shader returns uniform structure definitions by uniform name.
 * 
 * You can pass them to {@link makeStructuredView}
 * 
 * Example:
 * 
 * ```js
 * const code = `
 * struct MyUniforms {
 *    color: vec4<f32>,
 *    brightness: f32,
 *    kernel: array<f32, 9>,
 * };
 * @group(0) @binding(0) var<uniform> myUniforms: MyUniforms;
 * `;
 * const defs = makeUniformDefinitions(code);
 * const myUniformValues = makeStructuredView(defs.myUniforms);
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
 * @param code a WGSL shader source. Note: it is not required to be a complete shader
 * @returns definitions of the uniforms by name. Useful for passing to {@link makeStructuredView}
 */
export function makeUniformDefinitions(code: string): StructDefinitions {
    const reflect = new WgslReflect(code);

    return Object.fromEntries(reflect.uniforms.map(uniform => {
        const info = reflect.getUniformBufferInfo(uniform);
        return [uniform.name, addMembers(reflect, info.members, info.size)];
    }));
}
