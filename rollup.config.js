import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy-watch';
import pkg from './package.json';

const env = process?.env?.BUILD ?? 'development';
const watching = process?.env?.ROLLUP_WATCH ?? false;
const copyWatchArgs = watching ? { watch: 'assets/' } : {};

const sourcemap = env === 'development';
const plugins = (env === 'development') ? [] : [ terser() ];

export default [
  {
    input: {
      'backend': 'src/entry-backend.ts',
    },
    output: {
      dir: pkg.outputDir,
      format: 'es',
      sourcemap,
      plugins,
    },
    plugins: [
      typescript({tsconfig: './tsconfig.json'}),
      resolve(),
      commonjs({
        include: 'node_modules/**',
      }),
      copy({
        targets: [
          {
            src: 'assets/*',
            dest: pkg.outputDir,
          },
        ],
        copyOnce: true,
        flatten: false,

        ...copyWatchArgs,
        verbose: true,
      }),
    ],
    watch: {
      include: ['src/**/*'],
      clearScreen: false,
    },
  },
];

