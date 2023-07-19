import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy-watch';

const env = process?.env?.BUILD ?? 'development';
const watching = process?.env?.ROLLUP_WATCH ?? false;
const copyWatchArgs = watching ? { watch: 'assets/' } : {};

const sourcemap = env === 'development';
const plugins = (env === 'development') ? [] : [ terser() ];

export default [
  {
    input: 'src/entry.ts',
    output: {
      dir: 'dist/',
      format: 'es',
      sourcemap,
      plugins,
    },
    plugins: [
      typescript({tsconfig: './tsconfig.json'}),
      resolve(),
      commonjs({
        include: '../../node_modules/**',
      }),
      copy({
        targets: [
          {
            src: 'assets/*',
            dest: 'dist/',
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

