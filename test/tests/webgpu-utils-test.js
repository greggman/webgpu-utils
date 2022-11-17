import { describe, it } from '../mocha-support.js';
import { makeStructuredView, makeTypedArrayViews, setStructuredView, makeStructureDefinitions } from '../../dist/0.x/webgpu-utils.module.js';
import { assertArrayEqual, assertEqual, assertTruthy } from '../assert.js';

describe('webgpu-utils-tests', () => {

    it('generates views from shader source', () => {
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
        const defs = makeStructureDefinitions(shader);
        const {views, arrayBuffer} = makeStructuredView(defs.VSUniforms);
        assertEqual(arrayBuffer.byteLength, (16 + 4 + 8 + 4 + (3 + 1)) * 4);

        assertTruthy(views.worldViewProjection instanceof Float32Array);
        assertEqual(views.worldViewProjection.length, 16);
        assertEqual(views.worldViewProjection.byteOffset, 0);

        assertTruthy(views.lightDirection instanceof Float32Array);
        assertEqual(views.lightDirection.length, 3);
        assertEqual(views.lightDirection.byteOffset, (16 + 4 + 8 + 4) * 4);

    });

    it('generates views from structure source', () => {
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
        `;
        const defs = makeStructureDefinitions(shader);
        const {views, arrayBuffer} = makeStructuredView(defs.VSUniforms);
        assertEqual(arrayBuffer.byteLength, (16 + 4 + 8 + 4 + (3 + 1)) * 4);

        assertTruthy(views.worldViewProjection instanceof Float32Array);
        assertEqual(views.worldViewProjection.length, 16);
        assertEqual(views.worldViewProjection.byteOffset, 0);

        assertTruthy(views.lightDirection instanceof Float32Array);
        assertEqual(views.lightDirection.length, 3);
        assertEqual(views.lightDirection.byteOffset, (16 + 4 + 8 + 4) * 4);

    });

    it('it handles arrays of structs', () => {
        const shader = `
    struct VertexDesc {
        offset: u32,
        stride: u32,
        size: u32,
    };

    struct LineInfo {
        triDiv: u32,
        triMul: u32,
        midMod: u32,
        midDiv: u32,
        oddMod: u32,
        triMod: u32,
    };

    struct VSUniforms {
        worldViewProjection: mat4x4<f32>,
        position: array<VertexDesc, 4>,
        lineInfo: array<LineInfo, 5>,
        color: vec4<f32>,
        lightDirection: array<vec3<f32>, 6>,
    };
        `;
        const defs = makeStructureDefinitions(shader);
        const {views, set, arrayBuffer} = makeStructuredView(defs.VSUniforms);
        assertEqual(arrayBuffer.byteLength, (16 + 3 * 4 + 6 * 5 + 2 + 4 + (3 + 1) * 6) * 4);

        assertTruthy(views.worldViewProjection instanceof Float32Array);
        assertEqual(views.worldViewProjection.length, 16);
        assertEqual(views.worldViewProjection.byteOffset, 0);

        assertTruthy(views.lightDirection instanceof Float32Array);
        assertEqual(views.lightDirection.length, 6 * 4);
        assertEqual(views.lightDirection.byteOffset, (16 + 3 * 4 + 6 * 5 + 2 + 4) * 4);

        set({
            worldViewProjection: [1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34],
            position: [
                ,
                ,
                ,
                {offset: 111, stride: 222, size: 333},
            ],
            lineInfo: [
                ,
                ,
                ,
                {midMod: 444, triMod: 666},
            ],
            color: [100, 101, 102, 103],
            lightDirection: new Float32Array([
                901, 902, 903, 0,
                801, 802, 803, 0,
                701, 702, 703, 0,
                601, 602, 603, 0,
                501, 502, 503, 0,
                401, 402, 403, 0,
            ]),
        });

        assertArrayEqual(views.worldViewProjection, [1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34]);

        assertEqual(views.position[0].offset[0], 0);
        assertEqual(views.position[0].stride[0], 0);
        assertEqual(views.position[0].size[0], 0);

        assertEqual(views.position[1].offset[0], 0);
        assertEqual(views.position[1].stride[0], 0);
        assertEqual(views.position[1].size[0], 0);

        assertEqual(views.position[2].offset[0], 0);
        assertEqual(views.position[2].stride[0], 0);
        assertEqual(views.position[2].size[0], 0);

        assertEqual(views.position[3].offset[0], 111);
        assertEqual(views.position[3].stride[0], 222);
        assertEqual(views.position[3].size[0], 333);

        assertEqual(views.lineInfo[3].midMod[0], 444);
        assertEqual(views.lineInfo[3].triMod[0], 666);

        assertArrayEqual(views.color, [100, 101, 102, 103]);
        assertArrayEqual(views.lightDirection, [
                901, 902, 903, 0,
                801, 802, 803, 0,
                701, 702, 703, 0,
                601, 602, 603, 0,
                501, 502, 503, 0,
                401, 402, 403, 0,
            ]);
    });

});
