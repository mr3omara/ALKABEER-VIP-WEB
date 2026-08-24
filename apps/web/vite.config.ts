import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), ''),
    ...loadEnv(mode, path.resolve(process.cwd(), '../../'), ''),
  };

  const webPort = parseInt(env.VITE_PORT || env.PORT || '5173', 10);
  const apiPort = env.VITE_API_PORT || env.APP_PORT || env.PORT || '4000';
  const apiTarget = env.VITE_API_TARGET || `http://localhost:${apiPort}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@alkabeer/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    },
    server: {
      port: webPort,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
