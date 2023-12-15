import { StructDefinition, TypeDefinition, VariableDefinition } from './data-definitions.js';
import { TypedArrayConstructor, TypedArray } from './typed-arrays.js';
type TypeDef = {
    numElements: number;
    align: number;
    size: number;
    type: string;
    View: TypedArrayConstructor;
    flatten?: boolean;
    pad?: readonly number[];
};
declare const typeInfo: {
    readonly [K: string]: TypeDef;
};
export type kType = Extract<keyof typeof typeInfo, string>;
export declare const kTypes: readonly kType[];
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
 * `setIntrinsicsToView(['vec3f`])` and now you get
 * an array of 200 `Float32Array`s.
 *
 * Note: `setIntrinsicsToView` always sets ALL types. The list you
 * pass it is the types you want views created for, all other types
 * will be reset to do the default. In other words
 *
 * ```js
 * setIntrinsicsToView(['vec3f`])
 * setIntrinsicsToView(['vec2f`])
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
export declare function setIntrinsicsToView(types?: readonly kType[], flatten?: boolean): void;
export type TypedArrayOrViews = TypedArray | Views | Views[];
export interface Views {
    [x: string]: TypedArrayOrViews;
}
export type ArrayBufferViews = {
    views: any; // because otherwise this is too much of a PITA to use in typescript
    arrayBuffer: ArrayBuffer;
};
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
export declare function makeTypedArrayViews(typeDef: TypeDefinition, arrayBuffer?: ArrayBuffer, offset?: number): ArrayBufferViews;
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
export declare function setStructuredView(data: any, views: TypedArrayOrViews): void;
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
};
/**
 * Given a VariableDefinition, create matching TypedArray views
 * @param varDef A VariableDefinition as returned from {@link makeShaderDataDefinitions}
 * @param arrayBuffer Optional ArrayBuffer for the views
 * @param offset Optional offset into the ArrayBuffer for the views
 * @returns TypedArray views for the various named fields of the structure as well
 *    as a `set` function to make them easy to set, and the arrayBuffer
 */
export declare function makeStructuredView(varDef: VariableDefinition | StructDefinition, arrayBuffer?: ArrayBuffer, offset?: number): StructuredView;
/**
 * Sets values on an existing array buffer from a TypeDefinition
 * @param typeDef A type definition provided by @link {makeShaderDataDefinitions}
 * @param data The source data
 * @param arrayBuffer The arrayBuffer who's data to set.
 * @param offset An offset in the arrayBuffer to start at.
 */
export declare function setTypedValues(typeDef: TypeDefinition, data: any, arrayBuffer: ArrayBuffer, offset?: number): void;
/**
 * Same as @link {setTypedValues} except it takes a @link {VariableDefinition}.
 * @param typeDef A variable definition provided by @link {makeShaderDataDefinitions}
 * @param data The source data
 * @param arrayBuffer The arrayBuffer who's data to set.
 * @param offset An offset in the arrayBuffer to start at.
 */
export declare function setStructuredValues(varDef: VariableDefinition, data: any, arrayBuffer: ArrayBuffer, offset?: number): void;
export {};
