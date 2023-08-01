import { describe, it } from '../mocha-support.js';
import {
    makeShaderDataDefinitions,
} from '../../dist/0.x/webgpu-utils.module.js';
import { assertArrayEqual, assertEqual, assertFalsy, assertTruthy } from '../assert.js';

describe('data-definition-tests', () => {

    it('generates expected types, bindings, groups', () => {
        const shader = `
    struct VSUniforms {
        foo: u32,
    };
    @group(4) @binding(1) var<uniform> uni1: f32;
    @group(3) @binding(2) var<uniform> uni2: array<f32, 5>;
    @group(2) @binding(3) var<uniform> uni3: VSUniforms;
    @group(1) @binding(4) var<uniform> uni4: array<VSUniforms, 6>;

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }
        `;
        const d = makeShaderDataDefinitions(shader);
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

});

