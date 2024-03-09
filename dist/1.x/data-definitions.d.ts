/// <reference types="dist" />
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
export type IntrinsicDefinition = TypeDefinition & {
    type: string;
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
 * Warning: The properties of this type will probably be changed
 * in a future version. Please consider this an opaque type.
 */
export type ShaderDataDefinitions = {
    uniforms: VariableDefinitions;
    storages: VariableDefinitions;
    samplers: VariableDefinitions;
    textures: VariableDefinitions;
    storageTextures: VariableDefinitions;
    externalTextures: VariableDefinitions;
    structs: StructDefinitions;
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
 * Important: Assumes you pipeline is valid (it doesn't check for errors).
 *
 * Note: In WebGPU some layouts must be specified manually. For example an unfiltered-float
 *    sampler can not be derived since it is unknown at compile time pipeline creation time
 *    which texture you'll use.
 *
 * MAINTENANCE_TODO: Add example
 *
 * @param defs ShaderDataDefinitions or an array of ShaderDataDefinitions as
 *    returned from @link {makeShaderDataDefinitions}. If an array more than 1
 *    definition it's assumed the vertex shader is in the first and the fragment
 *    shader in the second.
 * @param desc A PipelineDescriptor. You should be able to pass in the same object you passed
 *    to `createRenderPipeline` or `createComputePipeline`.
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
