import { WgslReflect } from 'wgsl_reflect';
export { WgslReflect };
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
    uniforms: VariableDefinitions;
    storages: VariableDefinitions;
    structs: StructDefinitions;
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
