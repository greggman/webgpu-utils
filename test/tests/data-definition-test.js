import { describe, it } from '../mocha-support.js';
import {
    makeShaderDataDefinitions,
} from '../../dist/0.x/webgpu-utils.module.js';
import { assertEqual, assertFalsy, assertTruthy } from '../assert.js';

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
        assertEqual(defs.uni1.typeDefinition.type, 'f32');
        assertFalsy(defs.uni1.typeDefinition.numElements);
        assertEqual(defs.uni2.typeDefinition.elementType.type, 'f32');
        assertEqual(defs.uni2.typeDefinition.numElements, 5);
        assertEqual(defs.uni3.typeDefinition.fields.foo.type.type, 'u32');
        assertFalsy(defs.uni3.typeDefinition.fields.foo.numElements);
        assertEqual(defs.uni4.typeDefinition.numElements, 6);
        assertEqual(defs.uni4.typeDefinition.elementType.fields.foo.type.type, 'u32');

        assertEqual(defs.uni1.binding, 1);
        assertEqual(defs.uni2.binding, 2);
        assertEqual(defs.uni3.binding, 3);
        assertEqual(defs.uni4.binding, 4);

        assertEqual(defs.uni1.group, 4);
        assertEqual(defs.uni2.group, 3);
        assertEqual(defs.uni3.group, 2);
        assertEqual(defs.uni4.group, 1);
    });

    it('generates expected offsets', () => {
      const code = `
        struct VSUniforms {
            foo: u32,
            bar: f32,
            moo: vec3f,
            mrp: i32,
        };
        @group(4) @binding(1) var<uniform> uni1: VSUniforms;
      `;
      const d = makeShaderDataDefinitions(code);
      const def = d.uniforms.uni1;
      assertTruthy(def);
      assertEqual(def.typeDefinition.size, 32);
      assertEqual(def.typeDefinition.fields.foo.offset, 0);
      assertEqual(def.typeDefinition.fields.bar.offset, 4);
      assertEqual(def.typeDefinition.fields.moo.offset, 16);
      assertEqual(def.typeDefinition.fields.mrp.offset, 28);
    });

    it('works with alias', () => {
      const code = `
        alias material_index = u32;
        alias color = vec3f;

        struct Material {
            index: material_index,
            diffuse: color,
        };

        @group(0) @binding(1) var<storage> material: Material;
      `;
      const d = makeShaderDataDefinitions(code);
      const defs = d.storages;
      assertTruthy(defs);
      assertTruthy(defs.material);
      assertEqual(defs.material.size, 32);
      assertEqual(defs.material.typeDefinition.fields.index.offset, 0);
      assertEqual(defs.material.typeDefinition.fields.index.type.size, 4);
      assertEqual(defs.material.typeDefinition.fields.diffuse.offset, 16);
      assertEqual(defs.material.typeDefinition.fields.diffuse.type.size, 12);
    });

    it('works with arrays of arrays', () => {
        const code = `
            struct InnerUniforms {
                bar: u32,
                pad0: u32,
                pad1: u32,
                pad2: u32,
            };

            struct VSUniforms {
                foo: u32,
                moo: InnerUniforms,
                pad0: u32,
                pad1: u32,
                pad2: u32,
            };
            @group(0) @binding(0) var<uniform> foo0: vec3f;
            @group(0) @binding(1) var<uniform> foo1: array<vec3f, 5>;
            @group(0) @binding(2) var<uniform> foo2: array<array<vec3f, 5>, 6>;
            @group(0) @binding(3) var<uniform> foo3: array<array<array<vec3f, 5>, 6>, 7>;

            @group(0) @binding(4) var<uniform> foo4: VSUniforms;
            @group(0) @binding(5) var<uniform> foo5: array<VSUniforms, 5>;
            @group(0) @binding(6) var<uniform> foo6: array<array<VSUniforms, 5>, 6>;
            @group(0) @binding(7) var<uniform> foo7: array<array<array<VSUniforms, 5>, 6>, 7>;
        `;

        const d = makeShaderDataDefinitions(code);
        assertTruthy(d);
        assertEqual(d.uniforms.foo0.typeDefinition.numElements, undefined);
        assertEqual(d.uniforms.foo0.typeDefinition.type, 'vec3f');

        assertEqual(d.uniforms.foo1.typeDefinition.numElements, 5);
        assertEqual(d.uniforms.foo1.typeDefinition.size, 80);
        assertEqual(d.uniforms.foo1.typeDefinition.elementType.type, 'vec3f');

        assertEqual(d.uniforms.foo2.typeDefinition.numElements, 6);
        assertEqual(d.uniforms.foo2.typeDefinition.size, 80 * 6);
        assertEqual(d.uniforms.foo2.typeDefinition.elementType.numElements, 5);
        assertEqual(d.uniforms.foo2.typeDefinition.elementType.elementType.type, 'vec3f');

        assertEqual(d.uniforms.foo3.typeDefinition.numElements, 7);
        assertEqual(d.uniforms.foo3.typeDefinition.size, 80 * 6 * 7);
        assertEqual(d.uniforms.foo3.typeDefinition.elementType.numElements, 6);
        assertEqual(d.uniforms.foo3.typeDefinition.elementType.elementType.numElements, 5);
        assertEqual(d.uniforms.foo3.typeDefinition.elementType.elementType.elementType.type, 'vec3f');

        assertEqual(d.uniforms.foo4.typeDefinition.numElements, undefined);
        assertEqual(d.uniforms.foo4.typeDefinition.size, 32);
        assertEqual(d.uniforms.foo4.typeDefinition.fields.foo.type.type, 'u32');

        assertEqual(d.uniforms.foo5.typeDefinition.numElements, 5);
        assertEqual(d.uniforms.foo5.typeDefinition.size, 32 * 5);
        assertEqual(d.uniforms.foo5.typeDefinition.elementType.fields.foo.type.type, 'u32');

        assertEqual(d.uniforms.foo6.typeDefinition.numElements, 6);
        assertEqual(d.uniforms.foo6.typeDefinition.size, 32 * 5 * 6);
        assertEqual(d.uniforms.foo6.typeDefinition.elementType.numElements, 5);
        assertEqual(d.uniforms.foo6.typeDefinition.elementType.elementType.fields.foo.type.type, 'u32');

        assertEqual(d.uniforms.foo7.typeDefinition.numElements, 7);
        assertEqual(d.uniforms.foo7.typeDefinition.size, 32 * 5 * 6 * 7);
        assertEqual(d.uniforms.foo7.typeDefinition.elementType.numElements, 6);
        assertEqual(d.uniforms.foo7.typeDefinition.elementType.elementType.numElements, 5);
        assertEqual(d.uniforms.foo7.typeDefinition.elementType.elementType.elementType.fields.foo.type.type, 'u32');

    });

    it('generates correct info with unsized arrays', () => {
        const code = `
            struct InnerUniforms {
                bar: u32,
                pad0: u32,
                pad1: u32,
                pad2: u32,
            };

            struct VSUniforms {
                foo: u32,
                moo: InnerUniforms,
                pad0: u32,
                pad1: u32,
                pad2: u32,
            };
            @group(0) @binding(1) var<uniform> foo1: array<vec3f>;
            @group(0) @binding(2) var<uniform> foo2: array<array<vec3f, 5> >;

            @group(0) @binding(5) var<uniform> foo5: array<VSUniforms>;
            @group(0) @binding(6) var<uniform> foo6: array<array<VSUniforms, 5> >;
        `;

        const d = makeShaderDataDefinitions(code);
        assertTruthy(d);

        assertEqual(d.uniforms.foo1.typeDefinition.numElements, 0);
        assertEqual(d.uniforms.foo1.typeDefinition.elementType.type, 'vec3f');

        assertEqual(d.uniforms.foo2.typeDefinition.numElements, 0);
        assertEqual(d.uniforms.foo2.typeDefinition.elementType.elementType.type, 'vec3f');
        assertEqual(d.uniforms.foo2.typeDefinition.elementType.numElements, 5);

        assertEqual(d.uniforms.foo5.typeDefinition.numElements, 0);
        assertTruthy(d.uniforms.foo5.typeDefinition.elementType.fields);

        assertEqual(d.uniforms.foo6.typeDefinition.numElements, 0);
        assertEqual(d.uniforms.foo6.typeDefinition.elementType.numElements, 5);
        assertTruthy(d.uniforms.foo6.typeDefinition.elementType.elementType.fields);
    });
});

