import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json', {encoding: 'utf8'}));
const banner = `/* webgpu-utils@${pkg.version}, license MIT */`;

const plugins = [
    typescript({ tsconfig: './tsconfig.json' }),
];

export default [
    {
        input: 'src/webgpu-utils.ts',
        output: [
            {
                file: 'dist/0.x/webgpu-utils.module.js',
                format: 'esm',
                sourcemap: true,
                banner,
            },
        ],
        plugins,
    },
    {
        input: 'src/webgpu-utils.ts',
        output: [
            {
                name: 'webgpuUtils',
                file: 'dist/0.x/webgpu-utils.js',
                format: 'umd',
                sourcemap: true,
                banner,
            },
        ],
        plugins,
    },
    {
        input: 'src/webgpu-utils.ts',
        output: [
            {
                name: 'webgpuUtils',
                file: 'dist/0.x/webgpu-utils.min.js',
                format: 'umd',
                sourcemap: true,
                banner,
            },
        ],
        plugins: [
            ...plugins,
            terser(),
        ],
    },
];
