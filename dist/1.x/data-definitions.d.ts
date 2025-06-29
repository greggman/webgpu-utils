import { WGSLType } from './wgsl-types.js';
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
    elementType: TypeDefinition;
    numElements: number;
};
export type TextureDefinition = TypeDefinition & {
    type: string;
};
export type SamplerDefinition = TypeDefinition & {
    type: string;
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
};
export type EntryPoints = {
    [x: string]: EntryPoint;
};
/**
 * The data definitions and other reflection data from some WGSL shader source.
 */
export type ShaderDataDefinitions = {
    /**
     * definitions for uniform bindings by name
     */
    uniforms: VariableDefinitions;
    /**
     * definitions for storage bindings by name
     */
    storages: VariableDefinitions;
    /**
     * definitions for sampler bindings by name
     */
    samplers: VariableDefinitions;
    /**
     * definitions for texture bindings by name
     */
    textures: VariableDefinitions;
    /**
     * definitions for storage texture bindings by name
     */
    storageTextures: VariableDefinitions;
    /**
     * definitions for external texture bindings by name
     */
    externalTextures: VariableDefinitions;
    /**
     * definitions for structures by name
     */
    structs: StructDefinitions;
    /**
     * Entry points by name.
     */
    entryPoints: EntryPoints;
};
/**
 * This should be compatible with GPUProgramableStage
 */
export type ProgrammableStage = {
    entryPoint?: string;
};
/**
 * Compatible with GPURenderPipelineDescriptor and GPUComputePipelineDescriptor
 */
export type PipelineDescriptor = {
    vertex?: ProgrammableStage;
    fragment?: ProgrammableStage;
    compute?: ProgrammableStage;
};
/**
 * Gets GPUBindGroupLayoutDescriptors for the given pipeline.
 *
 * Important: Assumes your pipeline is valid (it doesn't check for errors).
 *
 * Note: In WebGPU some layouts must be specified manually. For example an unfiltered-float
 *    sampler can not be derived since it is unknown at compile time pipeline creation time
 *    which texture you'll use.
 *
 * ```js
 * import {
 *   makeShaderDataDefinitions,
 *   makeBindGroupLayoutDescriptors,
 * } from 'webgpu-utils';
 *
 * const code = `
 * @group(0) @binding(0) var<uniform> mat: mat4x4f;
 *
 * struct MyVSOutput {
 *   @builtin(position) position: vec4f,
 *   @location(1) texcoord: vec2f,
 * };
 *
 * @vertex
 * fn myVSMain(v: MyVSInput) -> MyVSOutput {
 *   var vsOut: MyVSOutput;
 *   vsOut.position = mat * v.position;
 *   vsOut.texcoord = v.texcoord;
 *   return vsOut;
 * }
 *
 * @group(0) @binding(2) var diffuseSampler: sampler;
 * @group(0) @binding(3) var diffuseTexture: texture_2d<f32>;
 *
 * @fragment
 * fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
 *   return textureSample(diffuseTexture, diffuseSampler, v.texcoord);
 * }
 * `;
 *
 * const module = device.createShaderModule({code});
 * const defs = wgh.makeShaderDataDefinitions(code);
 *
 * const pipelineDesc = {
 *   vertex: {
 *     module,
 *     entryPoint: 'myVSMain',
 *     buffers: bufferLayouts,
 *   },
 *   fragment: {
 *     module,
 *     entryPoint: 'myFSMain',
 *     targets: [
 *       {format: 'rgba8unorm'},
 *     ],
 *   },
 * };
 *
 * const descriptors = wgh.makeBindGroupLayoutDescriptors(defs, pipelineDesc);
 * const bindGroupLayouts = descriptors.map(desc => device.createBindGroupLayout(desc));
 * const layout = device.createPipelineLayout({ bindGroupLayouts });
 * const pipeline = device.createRenderPipeline({
 *   layout,
 *   ...pipelineDesc,
 * });
 * ```
 *
 * @param defs ShaderDataDefinitions or an array of ShaderDataDefinitions as
 *    returned from {@link makeShaderDataDefinitions}. If an array of  more than 1
 *    definition it's assumed the vertex shader is in the first and the fragment
 *    shader in the second.
 * @param desc A PipelineDescriptor. You should be able to pass in the same object you would pass
 *    to `createRenderPipeline` or `createComputePipeline`. In particular, you need
 *    the `vertex` / `fragment` or `compute` properties with or without entryPoints.
 *    The existence of the property means this shader type exists in the pipeline. If
 *    no entry point is specified the default entry point will be used, which, like
 *    WebGPU, defaults to the only entry point of that type. If there is more than one
 *    it's an error and you must specify an entry point.
 * @returns An array of GPUBindGroupLayoutDescriptors which you can pass, one at a time, to
 *    `createBindGroupLayout`. Note: the array will be sparse if there are gaps in group
 *    numbers. Note: Each GPUBindGroupLayoutDescriptor.entries will be sorted by binding.
 */
export declare function makeBindGroupLayoutDescriptors(defs: ShaderDataDefinitions | ShaderDataDefinitions[], desc: PipelineDescriptor): GPUBindGroupLayoutDescriptor[];
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
export declare function makeShaderDataDefinitions(code: string): ShaderDataDefinitions;
