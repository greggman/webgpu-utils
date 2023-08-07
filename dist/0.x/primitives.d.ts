import { TypedArray } from './typed-arrays.js';
import { Arrays } from './attribute-utils.js';
/**
 * A class to provide `push` on a typed array.
 *
 * example:
 *
 * ```js
 * const positions = new TypedArrayWrapper(new Float32Array(300), 3);
 * positions.push(1, 2, 3); // add a position
 * positions.push([4, 5, 6]);  // add a position
 * positions.push(new Float32Array(6)); // add 2 positions
 * const data = positions.typedArray;
 * ```
 */
export declare class TypedArrayWrapper<T extends TypedArray> {
    typedArray: T;
    cursor: number;
    numComponents: number;
    constructor(arr: T, numComponents: number);
    get numElements(): number;
    push(...data: (number | Iterable<number>)[]): void;
    reset(index?: number): void;
}
/**
 * Creates XY quad vertices
 *
 * The default with no parameters will return a 2x2 quad with values from -1 to +1.
 * If you want a unit quad with that goes from 0 to 1 you'd call it with
 *
 *     createXYQuadVertices(1, 0.5, 0.5);
 *
 * If you want a unit quad centered above 0,0 you'd call it with
 *
 *     primitives.createXYQuadVertices(1, 0, 0.5);
 *
 * @param size the size across the quad. Defaults to 2 which means vertices will go from -1 to +1
 * @param xOffset the amount to offset the quad in X
 * @param yOffset the amount to offset the quad in Y
 * @return the created XY Quad vertices
 */
export declare function createXYQuadVertices(size?: number, xOffset?: number, yOffset?: number): Arrays;
/**
 * Creates XZ plane vertices.
 *
 * The created plane has position, normal, and texcoord data
 *
 * @param width Width of the plane. Default = 1
 * @param depth Depth of the plane. Default = 1
 * @param subdivisionsWidth Number of steps across the plane. Default = 1
 * @param subdivisionsDepth Number of steps down the plane. Default = 1
 * @return The created plane vertices.
 */
export declare function createPlaneVertices(width?: number, depth?: number, subdivisionsWidth?: number, subdivisionsDepth?: number): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
/**
 * Creates sphere vertices.
 *
 * The created sphere has position, normal, and texcoord data
 *
 * @param radius radius of the sphere.
 * @param subdivisionsAxis number of steps around the sphere.
 * @param subdivisionsHeight number of vertically on the sphere.
 * @param startLatitudeInRadians where to start the
 *     top of the sphere.
 * @param endLatitudeInRadians Where to end the
 *     bottom of the sphere.
 * @param startLongitudeInRadians where to start
 *     wrapping the sphere.
 * @param endLongitudeInRadians where to end
 *     wrapping the sphere.
 * @return The created sphere vertices.
 */
export declare function createSphereVertices(radius?: number, subdivisionsAxis?: number, subdivisionsHeight?: number, startLatitudeInRadians?: number, endLatitudeInRadians?: number, startLongitudeInRadians?: number, endLongitudeInRadians?: number): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
/**
 * Creates the vertices and indices for a cube.
 *
 * The cube is created around the origin. (-size / 2, size / 2).
 *
 * @param size width, height and depth of the cube.
 * @return The created vertices.
 */
export declare function createCubeVertices(size?: number): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
/**
 * Creates vertices for a truncated cone, which is like a cylinder
 * except that it has different top and bottom radii. A truncated cone
 * can also be used to create cylinders and regular cones. The
 * truncated cone will be created centered about the origin, with the
 * y axis as its vertical axis. .
 *
 * @param bottomRadius Bottom radius of truncated cone.
 * @param topRadius Top radius of truncated cone.
 * @param height Height of truncated cone.
 * @param radialSubdivisions The number of subdivisions around the
 *     truncated cone.
 * @param verticalSubdivisions The number of subdivisions down the
 *     truncated cone.
 * @param topCap Create top cap. Default = true.
 * @param bottomCap Create bottom cap. Default = true.
 * @return The created cone vertices.
 */
export declare function createTruncatedConeVertices(bottomRadius?: number, topRadius?: number, height?: number, radialSubdivisions?: number, verticalSubdivisions?: number, topCap?: boolean, bottomCap?: boolean): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
/**
 * Creates 3D 'F' vertices.
 * An 'F' is useful because you can easily tell which way it is oriented.
 * The created 'F' has position, normal, texcoord, and color arrays.
 *
 * @return The created vertices.
 */
export declare function create3DFVertices(): {
    [k: string]: Uint8Array | Uint16Array | Float32Array;
};
/**
 * Creates crescent vertices.
 *
 * @param verticalRadius The vertical radius of the crescent.
 * @param outerRadius The outer radius of the crescent.
 * @param innerRadius The inner radius of the crescent.
 * @param thickness The thickness of the crescent.
 * @param subdivisionsDown number of steps around the crescent.
 * @param startOffset Where to start arc. Default 0.
 * @param endOffset Where to end arg. Default 1.
 * @return The created vertices.
 */
export declare function createCrescentVertices(verticalRadius: 2, outerRadius: 1, innerRadius: 0, thickness: 1, subdivisionsDown: 12, startOffset: 0, endOffset: 1): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
/**
 * Creates cylinder vertices. The cylinder will be created around the origin
 * along the y-axis.
 *
 * @param radius Radius of cylinder.
 * @param height Height of cylinder.
 * @param radialSubdivisions The number of subdivisions around the cylinder.
 * @param verticalSubdivisions The number of subdivisions down the cylinder.
 * @param topCap Create top cap. Default = true.
 * @param bottomCap Create bottom cap. Default = true.
 * @return The created vertices.
 */
export declare function createCylinderVertices(radius?: number, height?: number, radialSubdivisions?: number, verticalSubdivisions?: number, topCap?: boolean, bottomCap?: boolean): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
/**
 * Creates vertices for a torus
 *
 * @param radius radius of center of torus circle.
 * @param thickness radius of torus ring.
 * @param radialSubdivisions The number of subdivisions around the torus.
 * @param bodySubdivisions The number of subdivisions around the body torus.
 * @param startAngle start angle in radians. Default = 0.
 * @param endAngle end angle in radians. Default = Math.PI * 2.
 * @return The created vertices.
 */
export declare function createTorusVertices(radius?: number, thickness?: number, radialSubdivisions?: number, bodySubdivisions?: number, startAngle?: number, endAngle?: number): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
/**
 * Creates disc vertices. The disc will be in the xz plane, centered at
 * the origin. When creating, at least 3 divisions, or pie
 * pieces, need to be specified, otherwise the triangles making
 * up the disc will be degenerate. You can also specify the
 * number of radial pieces `stacks`. A value of 1 for
 * stacks will give you a simple disc of pie pieces.  If you
 * want to create an annulus you can set `innerRadius` to a
 * value > 0. Finally, `stackPower` allows you to have the widths
 * increase or decrease as you move away from the center. This
 * is particularly useful when using the disc as a ground plane
 * with a fixed camera such that you don't need the resolution
 * of small triangles near the perimeter. For example, a value
 * of 2 will produce stacks whose outside radius increases with
 * the square of the stack index. A value of 1 will give uniform
 * stacks.
 *
 * @param radius Radius of the ground plane.
 * @param divisions Number of triangles in the ground plane (at least 3).
 * @param stacks Number of radial divisions (default=1).
 * @param innerRadius Default 0.
 * @param stackPower Power to raise stack size to for decreasing width.
 * @return The created vertices.
 */
export declare function createDiscVertices(radius?: number, divisions?: number, stacks?: number, innerRadius?: number, stackPower?: number): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
