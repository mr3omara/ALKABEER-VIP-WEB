import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@alkabeer/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
