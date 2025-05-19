/* eslint-disable no-sparse-arrays */
import { describe, it } from '../mocha-support.js';
import {
    makeFlatView,
    setFlatView,
    makeShaderDataDefinitions,
} from '../../dist/1.x/webgpu-utils.module.js';
import { assertArrayEqual, assertEqual } from '../assert.js';

describe('flat-view-tests', () => {

    const arrayPart = (arr, start, len) => arr.subarray(start, start + len);

    it('generates handles built-in type aliases', () => {
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
        worldViewProjection: mat4x4f,
        position: VertexDesc,
        lineInfo: LineInfo,
        color: vec4f,
        lightDirection: vec3f,
    };

    @group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
    @group(0) @binding(1) var<storage> vertData: array<f32>;

    fn getVert(desc: VertexDesc, index: u32) -> vec4f {
        var v = vec4<f32>(0, 0, 0, 1);
        let offset = desc.offset + index * desc.stride;
        for (var i: u32 = 0u; i < desc.size; i += 1u) {
            v[i] = vertData[offset + i];
        }
        return v;
    }

    struct MyVSOutput {
        @builtin(position) position: vec4f,
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
    fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
        return vsUniforms.color + vec4(vsUniforms.lightDirection, 0) * 0.0;
    }
        `;
        const defs = makeShaderDataDefinitions(shader);
        const view = makeFlatView(defs.structs.VSUniforms);
        const { arrayBuffer } = view;
        assertEqual(arrayBuffer.byteLength, (16 + 4 + 8 + 4 + (3 + 1)) * 4);

        setFlatView(view, {
          worldViewProjection: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          position: {
            offset: 11,
            stride: 22,
            size: 33,
          },
          lineInfo: {
            triDiv: 111,
            triMul: 222,
            midMod: 333,
            // midDiv unset
            // oddMod unset
            triMod: 666,
          },
          color: [0.1, 0.2, 0.3, 0.4],
          lightDirection: [1.1, 2.2, 3.3],
        });

        assertArrayEqual(
          view.f32.subarray(0, 16),
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        );
        assertArrayEqual(
          arrayPart(view.u32, 16, 3),
          [11, 22, 33],
        );
        assertArrayEqual(
          arrayPart(view.u32, 20, 6),
          [111, 222, 333, 0, 0, 666],
        );
        assertArrayEqual(
          arrayPart(view.f32, 16 + 4 + 8 + 4, 3),
          new Float32Array([1.1, 2.2, 3.3]),
        );
    });
});
