import { WgslReflect, Member } from './3rdParty/wgsl_reflect/wgsl_reflect.module';

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
