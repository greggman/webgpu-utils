import { describe, it } from '../mocha-support.js';
import {
    makeStructuredView,
    setStructuredValues,
    makeShaderDataDefinitions,
} from '../../dist/0.x/webgpu-utils.module.js';
import { assertArrayEqual, assertEqual, assertFalsy, assertTruthy } from '../assert.js';

describe('webgpu-utils-tests', () => {

    it('generates expected types, bindings, groups', () => {
        const shader = `
    struct VSUniforms {
        foo: u32,
    };
    @group(4) @binding(1) var<uniform> uni1: f32;
    @group(3) @binding(2) var<uniform> uni2: array<f32, 5>;
    @group(2) @binding(3) var<uniform> uni3: VSUniforms;
    @group(1) @binding(4) var<uniform> uni4: array<VSUniforms, 6>;
        `;
        const d = makeShaderDataDefinitions(shader);
        console.log(d);
        const defs = d.uniforms;
        assertEqual(defs.uni1.type, 'f32');
        assertFalsy(defs.uni1.numElements);
        assertEqual(defs.uni2.type, 'f32');
        assertEqual(defs.uni2.numElements, 5);
        assertEqual(defs.uni3.fields.foo.type, 'u32');
        assertFalsy(defs.uni3.fields.foo.numElements);
        assertEqual(defs.uni4.length, 6);
        assertEqual(defs.uni4[0].fields.foo.type, 'u32');

        assertEqual(defs.uni1.binding, 1);
        assertEqual(defs.uni2.binding, 2);
        assertEqual(defs.uni3.binding, 3);
        assertEqual(defs.uni4.binding, 4);

        assertEqual(defs.uni1.group, 4);
        assertEqual(defs.uni2.group, 3);
        assertEqual(defs.uni3.group, 2);
        assertEqual(defs.uni4.group, 1);
    });

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
        const defs = makeShaderDataDefinitions(shader);
        const {views, arrayBuffer} = makeStructuredView(defs.structs.VSUniforms);
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
    @group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
    @group(0) @binding(1) var<storage> vsStorage: VSUniforms;

        `;
        const defs = makeShaderDataDefinitions(shader);

        const test = (f) => {
            const {views, arrayBuffer} = makeStructuredView(f);
            assertEqual(arrayBuffer.byteLength, (16 + 4 + 8 + 4 + (3 + 1)) * 4);

            assertTruthy(views.worldViewProjection instanceof Float32Array);
            assertEqual(views.worldViewProjection.length, 16);
            assertEqual(views.worldViewProjection.byteOffset, 0);

            assertTruthy(views.lightDirection instanceof Float32Array);
            assertEqual(views.lightDirection.length, 3);
            assertEqual(views.lightDirection.byteOffset, (16 + 4 + 8 + 4) * 4);
        };

        test(defs.structs.VSUniforms);
        test(defs.uniforms.vsUniforms);
        test(defs.storages.vsStorage);
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
        const defs = makeShaderDataDefinitions(shader).structs;
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

    it('makes arrays of base types the same for uniforms and structures', () => {
        const shader = `
        struct Test {
            foo: array<vec3<f32>, 16>,
        };
        @group(0) @binding(0) var<uniform> myUniformsStruct: Test;
        @group(0) @binding(1) var<uniform> myUniformsArray: array<vec3<f32>, 16>;
        `;
        const defs = makeShaderDataDefinitions(shader).uniforms;
        {
            const {set, arrayBuffer} = makeStructuredView(defs.myUniformsStruct);
            set({foo: [1, 22, 333]});
            const expected = new Float32Array(64);
            expected.set([1, 22, 333]);
            const actual = new Float32Array(arrayBuffer);
            assertArrayEqual(actual, expected);
        }
        {
            const {views, set} = makeStructuredView(defs.myUniformsArray);
            set([1, 22, 333]);
            const expected = new Float32Array(64);
            expected.set([1, 22, 333]);
            assertArrayEqual(views, expected);
        }
    });

    it('handles base types', () => {
        const shader = `
        @group(0) @binding(0) var<uniform> myUniforms: i32;
        `;
        const defs = makeShaderDataDefinitions(shader).uniforms;
        const {views, set} = makeStructuredView(defs.myUniforms);
        set([123]);
        assertArrayEqual(views, [123]);
    });

    it('handles array of base types', () => {
        const shader = `
        @group(0) @binding(0) var<uniform> myUniforms: array<vec3<f32>, 16>;
        `;
        const defs = makeShaderDataDefinitions(shader).uniforms;
        const {views, set} = makeStructuredView(defs.myUniforms);
        set([1, 22, 333]);
        const expected = new Float32Array(64);
        expected.set([1, 22, 333]);
        assertArrayEqual(views, expected);
    });

    it('sets structured values', () => {
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
                worldViewProjection: mat4x4<f32>,    // 0
                position: array<VertexDesc, 4>,      // (16 + (3 * ndx)) * 4 
                lineInfo: array<LineInfo, 5>,        // (16 + (3 * 4  ) + (6 * ndx)) * 4
                color: vec4<f32>,                    // (16 + (3 * 4  ) + (6 * 5  )) * 4
                lightDirection: array<vec3<f32>, 6>, // (16 + (3 * 4  ) + (6 * 5  ) + 4) * 4 
            };
            @group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
        `;
        const defs = makeShaderDataDefinitions(shader).uniforms;
        const def = defs.vsUniforms;
        const arrayBuffer = new ArrayBuffer(def.size);

        setStructuredValues(def, {
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
        }, arrayBuffer);

        const f32 = new Float32Array(arrayBuffer);
        const u32 = new Uint32Array(arrayBuffer);

        assertArrayEqual(f32.subarray(0, 16), [1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34]);

        const makeSub = (base, stride, size) => {
            return ndx => {
                const offset = base + stride * ndx;
                const range = [offset, offset + (size || stride)];
                return range;
            };
        };

        {
            const sub = makeSub(16, 3);
            assertArrayEqual(u32.subarray(...sub(0)), [0, 0, 0]);
            assertArrayEqual(u32.subarray(...sub(1)), [0, 0, 0]);
            assertArrayEqual(u32.subarray(...sub(2)), [0, 0, 0]);
            assertArrayEqual(u32.subarray(...sub(3)), [111, 222, 333]);
        }

        {
            const sub = makeSub(16 + 3 * 4, 6);
            assertArrayEqual(u32.subarray(...sub(0)), [0, 0, 0, 0, 0, 0]);
            assertArrayEqual(u32.subarray(...sub(1)), [0, 0, 0, 0, 0, 0]);
            assertArrayEqual(u32.subarray(...sub(2)), [0, 0, 0, 0, 0, 0]);
            assertArrayEqual(u32.subarray(...sub(3)), [0, 0, 444, 0, 0, 666]);
            assertArrayEqual(u32.subarray(...sub(4)), [0, 0, 0, 0, 0, 0]);
        }

        {
            const base = 16 + 3 * 4 + 6 * 5 + 2;
            assertArrayEqual(f32.subarray(base, base + 4), [100, 101, 102, 103]);
        }

        {
            const base = 16 + 3 * 4 + 6 * 5 + 2 + 4;
            assertArrayEqual(f32.subarray(base, base + 4 * 6), [
                    901, 902, 903, 0,
                    801, 802, 803, 0,
                    701, 702, 703, 0,
                    601, 602, 603, 0,
                    501, 502, 503, 0,
                    401, 402, 403, 0,
                ]);
        }
    });

});
