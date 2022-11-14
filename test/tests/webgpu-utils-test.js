import { describe, it } from '../mocha-support.js';
import { makeStructuredView, makeTypedArrayViews, setStructuredView } from '../../dist/0.x/webgpu-utils.module.js';
import { assertArrayEqual, assertEqual, assertTruthy } from '../assert.js';

import { WgslReflect } from '../../src/3rdParty/wgsl_reflect/wgsl_reflect.module.js';

describe('webgpu-utils-tests', () => {
    it('test builds typedarray views', () => {
        const vertexDesc = {
            offset: 'u32',
            stride: 'u32',
            size: 'u32',
            padding: 'u32',
        };

        const lineInfo = {
            triDiv: 'u32',
            triMul: 'u32',
            midMod: 'u32',
            midDiv: 'u32',
            oddMod: 'u32',
            triMod: 'u32',
            pad0: 'u32',
            pad1: 'u32',
        };

        const uniformDesc = {
            worldViewProjection: 'mat4x4<f32>',
            position: vertexDesc,
            lineInfo: lineInfo,
            color: 'vec4<f32>',
            lightDirection: 'vec3<f32>',
        };

        const views = makeTypedArrayViews(uniformDesc);
        const arrayBuffer = views.worldViewProjection.buffer;
        assertEqual(arrayBuffer.byteLength, (16 + 4 + 8 + 4 + 3) * 4);

        assertTruthy(views.worldViewProjection instanceof Float32Array);
        assertEqual(views.worldViewProjection.length, 16);
        assertEqual(views.worldViewProjection.byteOffset, 0);

        assertTruthy(views.lightDirection instanceof Float32Array);
        assertEqual(views.lightDirection.length, 3);
        assertEqual(views.lightDirection.byteOffset, (16 + 4 + 8 + 4) * 4);
    });

    it('test builds typedarray views with vec3', () => {
        const vertexDesc = {
            offset: 'vec3<f32>',
            stride: 'u32',
            size: 'u32',
            padding: 'u32',
        };

        const lineInfo = {
            triDiv: 'u32',
            triMul: 'u32',
            midMod: 'u32',
            midDiv: 'u32',
            oddMod: 'u32',
            triMod: 'u32',
            pad0: 'u32',
            pad1: 'u32',
        };

        const uniformDesc = {
            foo: 'vec3<f32>',
            worldViewProjection: 'mat4x4<f32>',
            position: vertexDesc,
            lineInfo: lineInfo,
            color: 'vec4<f32>',
            lightDirection: 'vec3<f32>',
        };

        const views = makeTypedArrayViews(uniformDesc);
        const arrayBuffer = views.worldViewProjection.buffer;
        assertEqual(arrayBuffer.byteLength, (4 + 16 + 6 + 8 + 2 + 4 + 3) * 4);

        assertTruthy(views.worldViewProjection instanceof Float32Array);
        assertEqual(views.worldViewProjection.length, 16);
        assertEqual(views.worldViewProjection.byteOffset, 16);

        assertTruthy(views.lightDirection instanceof Float32Array);
        assertEqual(views.lightDirection.length, 3);
        assertEqual(views.lightDirection.byteOffset, (4 + 16 + 6 + 8 + 2 + 4) * 4);
    });

    it('test setStructuredView', () => {
        const vertexDesc = {
            offset: 'vec3<f32>',
            stride: 'u32',
            size: 'u32',
            padding: 'u32',
        };

        const lineInfo = {
            triDiv: 'u32',
            triMul: 'u32',
            midMod: 'u32',
            midDiv: 'u32',
            oddMod: 'u32',
            triMod: 'u32',
            pad0: 'u32',
            pad1: 'u32',
        };

        const uniformDesc = {
            foo: 'vec3<f32>',
            worldViewProjection: 'mat4x4<f32>',
            position: vertexDesc,
            lineInfo: lineInfo,
            color: 'vec4<f32>',
            lightDirection: 'vec3<f32>',
        };

        const views = makeTypedArrayViews(uniformDesc);
        setStructuredView({
            foo: [1, 2, 3],
            worldViewProjection: new Float32Array([1, 2, 3, 4, 11, 22, 33, 44, 12, 13, 14, 15, 21, 22, 23, 24]),
            lineInfo: {
                triDiv: 111,
                triMod: 222,
                midMod: [333],
            },
            position: {
                stride: 789,
            },
            lightDirection: [333, 444, 555],
        }, views);
        assertArrayEqual(views.foo, [1, 2, 3]);
        assertArrayEqual(views.worldViewProjection, [1, 2, 3, 4, 11, 22, 33, 44, 12, 13, 14, 15, 21, 22, 23, 24]);
        assertArrayEqual(views.lineInfo.triDiv, [111]);
        assertArrayEqual(views.lineInfo.triMod, [222]);
        assertArrayEqual(views.lineInfo.midMod, [333]);
        assertArrayEqual(views.position.stride, [789]);
        assertArrayEqual(views.lightDirection, [333, 444, 555]);
    });

    it('test makeStructuredView', () => {
        const vertexDesc = {
            offset: 'vec3<f32>',
            stride: 'u32',
            size: 'u32',
            padding: 'u32',
        };

        const lineInfo = {
            triDiv: 'u32',
            triMul: 'u32',
            midMod: 'u32',
            midDiv: 'u32',
            oddMod: 'u32',
            triMod: 'u32',
            pad0: 'u32',
            pad1: 'u32',
        };

        const uniformDesc = {
            foo: 'vec3<f32>',
            worldViewProjection: 'mat4x4<f32>',
            position: vertexDesc,
            lineInfo: lineInfo,
            color: 'vec4<f32>',
            lightDirection: 'vec3<f32>',
        };

        const views = makeStructuredView(uniformDesc);
        views.set({
            foo: [1, 2, 3],
            worldViewProjection: new Float32Array([1, 2, 3, 4, 11, 22, 33, 44, 12, 13, 14, 15, 21, 22, 23, 24]),
            lineInfo: {
                triDiv: 111,
                triMod: 222,
                midMod: [333],
            },
            position: {
                stride: 789,
            },
            lightDirection: [333, 444, 555],
        }, views);
        assertArrayEqual(views.foo, [1, 2, 3]);
        assertArrayEqual(views.worldViewProjection, [1, 2, 3, 4, 11, 22, 33, 44, 12, 13, 14, 15, 21, 22, 23, 24]);
        assertArrayEqual(views.lineInfo.triDiv, [111]);
        assertArrayEqual(views.lineInfo.triMod, [222]);
        assertArrayEqual(views.lineInfo.midMod, [333]);
        assertArrayEqual(views.position.stride, [789]);
        assertArrayEqual(views.lightDirection, [333, 444, 555]);
    });

    it('foo', () => {
        const shader = `
    struct VertexDesc {
        offset: u32,
        stride: u32,
        size: u32,
        padding: u32,
    };

    struct LineInfo {
        triDiv: u32,
        triMul: u32,
        midMod: u32,
        midDiv: u32,
        oddMod: u32,
        triMod: u32,
        pad0: u32,
        pad1: u32,
    };

    struct VSUniforms {
        worldViewProjection: mat4x4<f32>,
        position: VertexDesc,
        lineInfo: LineInfo,
        color: vec4<f32>,
        lightDirection: vec3<f32>,
    };

    @group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
    @group(0) @binding(1) var<storage> vertData: array<f32>;

    fn getVert(desc: VertexDesc, index: u32) -> vec4<f32> {
        var v = vec4<f32>(0, 0, 0, 1);
        let offset = desc.offset + index * desc.stride;
        for (var i: u32 = 0u; i < desc.size; i += 1u) {
            v[i] = vertData[offset + i];
        }
        return v;
    }

    struct MyVSOutput {
        @builtin(position) position: vec4<f32>,
    };

    @vertex
    fn myVSMain(@builtin(vertex_index) vertex_index: u32) -> MyVSOutput {
        var vsOut: MyVSOutput;
        var i = (vertex_index / vsUniforms.lineInfo.triDiv) * vsUniforms.lineInfo.triMul +
                ((vertex_index % vsUniforms.lineInfo.midMod) / vsUniforms.lineInfo.midDiv +
                (vertex_index % vsUniforms.lineInfo.oddMod)) % vsUniforms.lineInfo.triMod;
        let position = getVert(vsUniforms.position, i);
        vsOut.position = vsUniforms.worldViewProjection * position;
        return vsOut;
    }

    @fragment
    fn myFSMain(v: MyVSOutput) -> @location(0) vec4<f32> {
        return vsUniforms.color + vec4(vsUniforms.lightDirection, 0) * 0.0;
    }
        `;
        const reflect = new WgslReflect(shader);
        window.r = reflect;
        console.log(reflect);
    });

});
