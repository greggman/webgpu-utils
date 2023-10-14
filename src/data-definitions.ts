import {
    WgslReflect,
    ArrayInfo,
    StructInfo,
    TemplateInfo,
    TypeInfo,
    VariableInfo,
} from 'wgsl_reflect';

export type FieldDefinition = {
    offset: number;
    type: TypeDefinition;
};

export type FieldDefinitions = {
    [x: string]: FieldDefinition;
};

export type TypeDefinition = {
    size: number;
};

// These 3 types are wonky. Maybe we should make them inherit from a common
// type with a `type` field. I wanted this to be a plain object though, not an object
// with a constructor. In any case, right now, the way you tell them apart is
// If it's got `elementType` then it's an ArrayDefinition
// If it's got `fields` then it's a StructDefinition
// else it's an IntrinsicDefinition
export type StructDefinition = TypeDefinition & {
    fields: FieldDefinitions;
    size: number;
};

export type IntrinsicDefinition = TypeDefinition & {
    type: string;
    numElements?: number;
};

export type ArrayDefinition = TypeDefinition & {
    elementType: TypeDefinition,
    numElements: number,
};

/**
 * @group(x) @binding(y) var<...> definition
 */
export interface VariableDefinition {
    binding: number;
    group: number;
    size: number;
    typeDefinition: TypeDefinition;
}

export type StructDefinitions = {
    [x: string]: StructDefinition;
};

export type VariableDefinitions = {
    [x: string]: VariableDefinition;
};

type ShaderDataDefinitions = {
    uniforms: VariableDefinitions,
    storages: VariableDefinitions,
    structs: StructDefinitions,
};

function getNamedVariables(reflect: WgslReflect, variables: VariableInfo[]): VariableDefinitions {
    return Object.fromEntries(variables.map(v => {
        const typeDefinition = addType(reflect, v.type, 0);
        return [
            v.name,
            {
                typeDefinition,
                group: v.group,
                binding: v.binding,
                size: typeDefinition.size,
            },
        ];
    })) as VariableDefinitions;
}

function makeStructDefinition(reflect: WgslReflect, structInfo: StructInfo, offset: number) {
    // StructDefinition
    const fields: FieldDefinitions = Object.fromEntries(structInfo.members.map(m => {
        return [
            m.name,
            {
                offset: m.offset,
                type: addType(reflect, m.type, 0),
            },
        ];
    }));
    return {
        fields,
        size: structInfo.size,
        offset,
    };
}

/**
 * Given a WGSL shader, returns data definitions for structures,
 * uniforms, and storage buffers
 *
 * Example:
 *
 * ```js
 * const code = `
 * struct MyStruct {
 *    color: vec4f,
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

    const structs = Object.fromEntries(reflect.structs.map(structInfo => {
        return [structInfo.name, makeStructDefinition(reflect, structInfo, 0)];
    }));

    const uniforms = getNamedVariables(reflect, reflect.uniforms);
    const storages = getNamedVariables(reflect, reflect.storage);

    return {
        structs,
        storages,
        uniforms,
    };
}

function assert(cond: boolean, msg = '') {
    if (!cond) {
        throw new Error(msg);
    }
}

/*
 write down what I want for a given type

    struct VSUniforms {
        foo: u32,
    };
    @group(4) @binding(1) var<uniform> uni1: f32;
    @group(3) @binding(2) var<uniform> uni2: array<f32, 5>;
    @group(2) @binding(3) var<uniform> uni3: VSUniforms;
    @group(1) @binding(4) var<uniform> uni4: array<VSUniforms, 6>;

    uni1: {
        type: 'f32',
        numElements: undefined
    },
    uni2: {
        type: 'array',
        elementType: 'f32'
        numElements: 5,
    },
    uni3: {
        type: 'struct',
        fields: {
            foo: {
                type: 'f32',
                numElements: undefined
            }
        },
    },
    uni4: {
        type: 'array',
        elementType:
        fields: {
            foo: {
                type: 'f32',
                numElements: undefined
            }
        },
        fields: {
            foo: {
                type: 'f32',
                numElements: undefined
            }
        },
        ...
    ]

    */



function addType(reflect: WgslReflect, typeInfo: TypeInfo, offset: number):
  StructDefinition |
  IntrinsicDefinition |
  ArrayDefinition {
    if (typeInfo.isArray) {
        assert(!typeInfo.isStruct, 'struct array is invalid');
        assert(!typeInfo.isStruct, 'template array is invalid');
        const arrayInfo = typeInfo as ArrayInfo;
        // ArrayDefinition
        return {
            size: arrayInfo.size,
            elementType: addType(reflect, arrayInfo.format, offset),
            numElements: arrayInfo.count,
        };
    } else if (typeInfo.isStruct) {
        assert(!typeInfo.isTemplate, 'template struct is invalid');
        const structInfo = typeInfo as StructInfo;
        return makeStructDefinition(reflect, structInfo, offset);
    } else {
        // template is like vec4<f32> or mat4x4<f16>
        const asTemplateInfo = typeInfo as TemplateInfo;
        const type = typeInfo.isTemplate
           ? `${asTemplateInfo.name}<${asTemplateInfo.format!.name}>`
           : typeInfo.name;
        // IntrinsicDefinition
        return {
            size: typeInfo.size,
            type,
        };
    }
}

