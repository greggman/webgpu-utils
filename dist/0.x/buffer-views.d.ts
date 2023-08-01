import { FieldDefinition, StructDefinition } from './data-definitions.js';
import { TypedArray } from './typed-arrays.js';
export type TypedArrayOrViews = TypedArray | Views | Views[];
export interface Views {
    [x: string]: TypedArrayOrViews;
}
export type ArrayBufferViews = {
    views: any; // because otherwise this is too much of a PITA to use in typescript
    arrayBuffer: ArrayBuffer;
};
/**
 * Creates a set of named TypedArray views on an ArrayBuffer
 * @param structDef Definition of the various types of views.
 * @param arrayBuffer Optional ArrayBuffer to use (if one provided one will be created)
 * @param offset Optional offset in existing ArrayBuffer to start the views.
 * @returns A bunch of named TypedArray views and the ArrayBuffer
 */
export declare function makeTypedArrayViews(structDef: StructDefinition, arrayBuffer?: ArrayBuffer, offset?: number): ArrayBufferViews;
/**
 * Given a set of TypeArrayViews and matching JavaScript data
 * sets the content of the views.
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
 * Given a StructDefinition, create matching TypedArray views
 * @param structDef A StructDefinition as returned from {@link makeShaderDataDefinitions}
 * @param arrayBuffer Optional ArrayBuffer for the views
 * @param offset Optional offset into the ArrayBuffer for the views
 * @returns TypedArray views for the various named fields of the structure as well
 *    as a `set` function to make them easy to set, and the arrayBuffer
 */
export declare function makeStructuredView(structDef: StructDefinition, arrayBuffer?: ArrayBuffer, offset?: number): StructuredView;
export declare function setStructuredValues(fieldDef: FieldDefinition, data: any, arrayBuffer: ArrayBuffer, offset?: number): void;
