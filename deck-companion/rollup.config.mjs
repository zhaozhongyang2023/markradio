import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.tsx',
  external: ['react', 'react-dom', '@decky/ui', '@decky/api'],
  output: {
    file: 'dist/index.js',
    format: 'iife',
    name: 'MoodWaveDeckCompanion',
    globals: {
      react: 'SP_REACT',
      'react-dom': 'SP_REACTDOM',
      '@decky/ui': 'DFL',
      '@decky/api': 'DFL'
    }
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' })
  ]
};
