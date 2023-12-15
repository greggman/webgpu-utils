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
 * @param params
 * @param params.size the size across the quad. Defaults to 2 which means vertices will go from -1 to +1
 * @param params.xOffset the amount to offset the quad in X. Default = 0
 * @param params.yOffset the amount to offset the quad in Y. Default = 0
 * @return the created XY Quad vertices
 */
export declare function createXYQuadVertices({ size: inSize, xOffset, yOffset }?: {
    size?: number | undefined;
    xOffset?: number | undefined;
    yOffset?: number | undefined;
}): Arrays;
/**
 * Creates XZ plane vertices.
 *
 * The created plane has position, normal, and texcoord data
 *
 * @param params
 * @param params.width Width of the plane. Default = 1
 * @param params.depth Depth of the plane. Default = 1
 * @param params.subdivisionsWidth Number of steps across the plane. Default = 1
 * @param params.subdivisionsDepth Number of steps down the plane. Default = 1
 * @return The created plane vertices.
 */
export declare function createPlaneVertices({ width, depth, subdivisionsWidth, subdivisionsDepth, }?: {
    width?: number | undefined;
    depth?: number | undefined;
    subdivisionsWidth?: number | undefined;
    subdivisionsDepth?: number | undefined;
}): {
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
 * @param params
 * @param params.radius radius of the sphere. Default = 1
 * @param params.subdivisionsAxis number of steps around the sphere. Default = 24
 * @param params.subdivisionsHeight number of vertically on the sphere. Default = 12
 * @param params.startLatitudeInRadians where to start the
 *     top of the sphere. Default = 0
 * @param params.endLatitudeInRadians Where to end the
 *     bottom of the sphere. Default = π
 * @param params.startLongitudeInRadians where to start
 *     wrapping the sphere. Default = 0
 * @param params.endLongitudeInRadians where to end
 *     wrapping the sphere. Default = 2π
 * @return The created sphere vertices.
 */
export declare function createSphereVertices({ radius, subdivisionsAxis, subdivisionsHeight, startLatitudeInRadians, endLatitudeInRadians, startLongitudeInRadians, endLongitudeInRadians, }?: {
    radius?: number | undefined;
    subdivisionsAxis?: number | undefined;
    subdivisionsHeight?: number | undefined;
    startLatitudeInRadians?: number | undefined;
    endLatitudeInRadians?: number | undefined;
    startLongitudeInRadians?: number | undefined;
    endLongitudeInRadians?: number | undefined;
}): {
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
 * @param params
 * @param params.size width, height and depth of the cube. Default = 1
 * @return The created vertices.
 */
export declare function createCubeVertices({ size }?: {
    size?: number | undefined;
}): {
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
 * @param bottomRadius Bottom radius of truncated cone. Default = 1
 * @param topRadius Top radius of truncated cone. Default = 0
 * @param height Height of truncated cone. Default = 1
 * @param radialSubdivisions The number of subdivisions around the
 *     truncated cone. Default = 24
 * @param verticalSubdivisions The number of subdivisions down the
 *     truncated cone. Default = 1
 * @param topCap Create top cap. Default = true.
 * @param bottomCap Create bottom cap. Default = true.
 * @return The created cone vertices.
 */
export declare function createTruncatedConeVertices({ bottomRadius, topRadius, height, radialSubdivisions, verticalSubdivisions, topCap, bottomCap, }?: {
    bottomRadius?: number | undefined;
    topRadius?: number | undefined;
    height?: number | undefined;
    radialSubdivisions?: number | undefined;
    verticalSubdivisions?: number | undefined;
    topCap?: boolean | undefined;
    bottomCap?: boolean | undefined;
}): {
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
 * @param params
 * @param params.verticalRadius The vertical radius of the crescent. Default = 2
 * @param params.outerRadius The outer radius of the crescent. Default = 1
 * @param params.innerRadius The inner radius of the crescent. Default = 0
 * @param params.thickness The thickness of the crescent. Default = 1
 * @param params.subdivisionsDown number of steps around the crescent. Default = 12
 * @param params.startOffset Where to start arc. Default 0. Default = 0
 * @param params.endOffset Where to end arg. Default 1. Default = 1
 * @return The created vertices.
 */
export declare function createCrescentVertices({ verticalRadius, outerRadius, innerRadius, thickness, subdivisionsDown, startOffset, endOffset, }?: {
    verticalRadius?: number | undefined;
    outerRadius?: number | undefined;
    innerRadius?: number | undefined;
    thickness?: number | undefined;
    subdivisionsDown?: number | undefined;
    startOffset?: number | undefined;
    endOffset?: number | undefined;
}): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
/**
 * Creates cylinder vertices. The cylinder will be created around the origin
 * along the y-axis.
 *
 * @param params
 * @param params.radius Radius of cylinder. Default = 1
 * @param params.height Height of cylinder. Default = 1
 * @param params.radialSubdivisions The number of subdivisions around the cylinder. Default = 24
 * @param params.verticalSubdivisions The number of subdivisions down the cylinder. Default = 1
 * @param params.topCap Create top cap. Default = true.
 * @param params.bottomCap Create bottom cap. Default = true.
 * @return The created vertices.
 */
export declare function createCylinderVertices({ radius, height, radialSubdivisions, verticalSubdivisions, topCap, bottomCap, }?: {
    radius?: number | undefined;
    height?: number | undefined;
    radialSubdivisions?: number | undefined;
    verticalSubdivisions?: number | undefined;
    topCap?: boolean | undefined;
    bottomCap?: boolean | undefined;
}): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
/**
 * Creates vertices for a torus
 *
 * @param params
 * @param params.radius radius of center of torus circle. Default = 1
 * @param params.thickness radius of torus ring. Default = 0.24
 * @param params.radialSubdivisions The number of subdivisions around the torus. Default = 24
 * @param params.bodySubdivisions The number of subdivisions around the body torus. Default = 12
 * @param params.startAngle start angle in radians. Default = 0.
 * @param params.endAngle end angle in radians. Default = Math.PI * 2.
 * @return The created vertices.
 */
export declare function createTorusVertices({ radius, thickness, radialSubdivisions, bodySubdivisions, startAngle, endAngle, }?: {
    radius?: number | undefined;
    thickness?: number | undefined;
    radialSubdivisions?: number | undefined;
    bodySubdivisions?: number | undefined;
    startAngle?: number | undefined;
    endAngle?: number | undefined;
}): {
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
 * @param params
 * @param params.radius Radius of the ground plane. Default = 1
 * @param params.divisions Number of triangles in the ground plane (at least 3). Default = 24
 * @param params.stacks Number of radial divisions. Default = 1
 * @param params.innerRadius Default = 0
 * @param params.stackPower Power to raise stack size to for decreasing width. Default = 1
 * @return The created vertices.
 */
export declare function createDiscVertices({ radius, divisions, stacks, innerRadius, stackPower, }?: {
    radius?: number | undefined;
    divisions?: number | undefined;
    stacks?: number | undefined;
    innerRadius?: number | undefined;
    stackPower?: number | undefined;
}): {
    position: Float32Array;
    normal: Float32Array;
    texcoord: Float32Array;
    indices: Uint16Array;
};
