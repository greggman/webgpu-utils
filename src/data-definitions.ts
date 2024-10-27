import {
    WgslReflect,
    ArrayInfo,
    StructInfo,
    TemplateInfo,
    TypeInfo,
    VariableInfo,
    FunctionInfo,
    ResourceType,
} from 'wgsl_reflect';
import {
    WGSLType,
} from './wgsl-types.js';

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

export { WGSLType };

export type IntrinsicDefinition = TypeDefinition & {
    type: WGSLType;
    numElements?: number;
};

export type ArrayDefinition = TypeDefinition & {
    elementType: TypeDefinition,
    numElements: number,
};

export type TextureDefinition = TypeDefinition & {
    type: string,
};

export type SamplerDefinition = TypeDefinition & {
    type: string,
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

export type Resource = {
    name: string;
    group: number;
    entry: GPUBindGroupLayoutEntry;
};

export type EntryPoint = {
    stage: GPUShaderStageFlags;
    resources: Resource[];
}

export type EntryPoints = {
    [x: string]: EntryPoint;
}

/**
 * The data definitions and other reflection data from some WGSL shader source.
 */
export type ShaderDataDefinitions = {
    /**
     * definitions for uniform bindings by name
     */
    uniforms: VariableDefinitions,
    /**
     * definitions for storage bindings by name
     */
    storages: VariableDefinitions,
    /**
     * definitions for sampler bindings by name
     */
    samplers: VariableDefinitions,
    /**
     * definitions for texture bindings by name
     */
    textures: VariableDefinitions,
    /**
     * definitions for storage texture bindings by name
     */
    storageTextures: VariableDefinitions,
    /**
     * definitions for external texture bindings by name
     */
    externalTextures: VariableDefinitions,
    /**
     * definitions for structures by name
     */
    structs: StructDefinitions,
    /**
     * Entry points by name.
     */
    entryPoints: EntryPoints,
};

/**
 * This should be compatible with GPUProgramableStage
 */
export type ProgrammableStage = {
    entryPoint?: string,
}

/**
 * Compatible with GPURenderPipelineDescriptor and GPUComputePipelineDescriptor
 */
export type PipelineDescriptor = {
    vertex?: ProgrammableStage,
    fragment?: ProgrammableStage,
    compute?: ProgrammableStage,
};

function getEntryPointForStage(defs: ShaderDataDefinitions, stage: ProgrammableStage, stageFlags: GPUShaderStageFlags) {
    const {entryPoint: entryPointName} = stage;
    if (entryPointName) {
        const ep = defs.entryPoints[entryPointName];
        return (ep && ep.stage === stageFlags) ? ep : undefined;
    }

    return Object.values(defs.entryPoints).filter(ep => ep.stage === stageFlags)[0];
}

function getStageResources(defs: ShaderDataDefinitions, stage: ProgrammableStage | undefined, stageFlags: GPUShaderStageFlags) {
    if (!stage) {
        return [];
    }
    const entryPoint = getEntryPointForStage(defs, stage, stageFlags);
    return entryPoint?.resources || [];
}

const byBinding = (a: GPUBindGroupLayoutEntry, b: GPUBindGroupLayoutEntry) => Math.sign(a.binding - b.binding);

/**
 * Gets GPUBindGroupLayoutDescriptors for the given pipeline.
 *
 * Important: Assumes you pipeline is valid (it doesn't check for errors).
 *
 * Note: In WebGPU some layouts must be specified manually. For example an unfiltered-float
 *    sampler can not be derived since it is unknown at compile time pipeline creation time
 *    which texture you'll use.
 *
 * MAINTENANCE_TODO: Add example
 *
 * @param defs ShaderDataDefinitions or an array of ShaderDataDefinitions as
 *    returned from {@link makeShaderDataDefinitions}. If an array more than 1
 *    definition it's assumed the vertex shader is in the first and the fragment
 *    shader in the second.
 * @param desc A PipelineDescriptor. You should be able to pass in the same object you passed
 *    to `createRenderPipeline` or `createComputePipeline`.
 * @returns An array of GPUBindGroupLayoutDescriptors which you can pass, one at a time, to
 *    `createBindGroupLayout`. Note: the array will be sparse if there are gaps in group
 *    numbers. Note: Each GPUBindGroupLayoutDescriptor.entries will be sorted by binding.
 */
export function makeBindGroupLayoutDescriptors(
    defs: ShaderDataDefinitions | ShaderDataDefinitions[],
    desc: PipelineDescriptor,
): GPUBindGroupLayoutDescriptor[] {
    defs = Array.isArray(defs) ? defs : [defs];
    const resources = [
        ...getStageResources(defs[0], desc.vertex, GPUShaderStage.VERTEX),
        ...getStageResources(defs[defs.length - 1], desc.fragment, GPUShaderStage.FRAGMENT),
        ...getStageResources(defs[0], desc.compute, GPUShaderStage.COMPUTE),
    ];
    const bindGroupLayoutDescriptorsByGroupByBinding: Map<number, GPUBindGroupLayoutEntry>[] = [];
    for (const resource of resources) {
        const bindingsToBindGroupEntry = bindGroupLayoutDescriptorsByGroupByBinding[resource.group] || new Map<number, GPUBindGroupLayoutEntry>();
        bindGroupLayoutDescriptorsByGroupByBinding[resource.group] = bindingsToBindGroupEntry;
        // Should we error here if the 2 don't match?
        const entry = bindingsToBindGroupEntry.get(resource.entry.binding);
        bindingsToBindGroupEntry.set(resource.entry.binding, {
            ...resource.entry,
            visibility: resource.entry.visibility | (entry?.visibility || 0),
        });
    }
    const descriptors = bindGroupLayoutDescriptorsByGroupByBinding.map(v => ({entries: [...v.values()].sort(byBinding) }));
    for (let i = 0; i < descriptors.length; ++i) {
        if (!descriptors[i]) {
            descriptors[i] = { entries: [] };
        }
    }
    return descriptors;
}

function getNamedVariables(reflect: WgslReflect, variables: VariableInfo[]): VariableDefinitions {
    return Object.fromEntries(variables.map(v => {
        const typeDefinition = addVariableType(reflect, v, 0);
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

function getTextureSampleType(type: TypeInfo) {
    if (type.name.includes('depth')) {
        return 'depth';
    }
    // unfiltered-float
    switch ((type as TemplateInfo).format?.name) {
        case 'f32': return 'float';
        case 'i32': return 'sint';
        case 'u32': return 'uint';
        default:
            throw new Error('unknown texture sample type');
    }
}

function getViewDimension(type: TypeInfo): GPUTextureViewDimension {
    if (type.name.includes('2d_array')) {
        return '2d-array';
    }
    if (type.name.includes('cube_array')) {
        return 'cube-array';
    }
    if (type.name.includes('3d')) {
        return '3d';
    }
    if (type.name.includes('1d')) {
        return '1d';
    }
    if (type.name.includes('cube')) {
        return 'cube';
    }
    return '2d';
}

function getStorageTextureAccess(type: TypeInfo): GPUStorageTextureAccess {
    switch ((type as TemplateInfo).access) {
        case 'read': return 'read-only';
        case 'write': return 'write-only';
        case 'read_write': return 'read-write';
        default:
            throw new Error('unknonw storage texture access');
    }
}

function getSamplerType(type: TypeInfo) {
    // "non-filtering" can only be specified manually.
    return type.name.endsWith('_comparison')
        ? 'comparison'
        : 'filtering';
}

function getBindGroupLayoutEntry(resource: VariableInfo, visibility: GPUShaderStageFlags): GPUBindGroupLayoutEntry {
    const { binding, access, type } = resource;
    switch (resource.resourceType) {
        case ResourceType.Uniform:
            return {
                binding,
                visibility,
                buffer: {
                    ...(resource.size && { minBindingSize: resource.size }),
                },
            };
        case ResourceType.Storage:
            return {
                binding,
                visibility,
                buffer: {
                    type: (access === '' || access === 'read') ? 'read-only-storage' : 'storage',
                    ...(resource.size && { minBindingSize: resource.size }),
                },
            };
        case ResourceType.Texture: {
            if (type.name === 'texture_external') {
                return {
                    binding,
                    visibility,
                    externalTexture: {},
                };
            }
            const multisampled = type.name.includes('multisampled');
            return {
                binding,
                visibility,
                texture: {
                    sampleType: getTextureSampleType(type),
                    viewDimension: getViewDimension(type),
                    multisampled,
                },
            };
        }
        case ResourceType.Sampler:
            return {
                binding,
                visibility,
                sampler: {
                    type: getSamplerType(type),
                },
            };
        case ResourceType.StorageTexture:
            return {
                binding,
                visibility,
                storageTexture: {
                    access: getStorageTextureAccess(type),
                    format: ((type as TemplateInfo).format!.name as GPUTextureFormat),
                    viewDimension: getViewDimension(type),
                },
            };
        default:
            throw new Error('unknown resource type');
    }
}

function addEntryPoints(funcInfos: FunctionInfo[], stage: GPUShaderStageFlags): EntryPoints {
    const entryPoints: EntryPoints = {};
    for (const info of funcInfos) {
        entryPoints[info.name] = {
            stage,
            resources: info.resources.map(resource => {
                const {name, group} = resource;
                return {
                    name,
                    group,
                    entry: getBindGroupLayoutEntry(resource, stage),
                };
            }),
        };
    }
    return entryPoints;
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
    const storages = getNamedVariables(reflect, reflect.storage.filter(v => v.resourceType === ResourceType.Storage));
    const storageTextures = getNamedVariables(reflect, reflect.storage.filter(v => v.resourceType === ResourceType.StorageTexture));
    const textures = getNamedVariables(reflect, reflect.textures.filter(v => v.type.name !== 'texture_external'));
    const externalTextures = getNamedVariables(reflect, reflect.textures.filter(v => v.type.name === 'texture_external'));
    const samplers = getNamedVariables(reflect, reflect.samplers);

    const entryPoints: EntryPoints = {
        ...addEntryPoints(reflect.entry.vertex, GPUShaderStage.VERTEX),
        ...addEntryPoints(reflect.entry.fragment, GPUShaderStage.FRAGMENT),
        ...addEntryPoints(reflect.entry.compute, GPUShaderStage.COMPUTE),
    };

    return {
        externalTextures,
        samplers,
        structs,
        storages,
        storageTextures,
        textures,
        uniforms,
        entryPoints,
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

function addVariableType(reflect: WgslReflect, v: VariableInfo, offset: number):
    StructDefinition |
    IntrinsicDefinition |
    ArrayDefinition |
    TextureDefinition |
    SamplerDefinition {
    switch (v.resourceType) {
        case ResourceType.Uniform:
        case ResourceType.Storage:
        case ResourceType.StorageTexture:
            return addType(reflect, v.type, offset);
        default:
            return {
                size: 0,
                type: v.type.name,
            };
    }
}

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
            type: type as WGSLType,
        };
    }
}
