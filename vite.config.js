import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 开发代理目标 — 通过环境变量适配不同平台
// 树莓派: MOODWAVE_API_PORT=8765 (默认)
// Steam Deck: MOODWAVE_API_PORT=38765
const apiPort = process.env.MOODWAVE_API_PORT || process.env.MOODWAVE_PORT || '8765';
const apiTarget = `http://127.0.0.1:${apiPort}`;
const wsTarget = `ws://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.MOODWAVE_WEB_PORT || process.env.MARKRADIO_WEB_PORT || 8080),
    proxy: {
      '/api': apiTarget,
      '/ws': {
        target: wsTarget,
        ws: true
      },
      '/tts': apiTarget
    }
  },
  build: {
    outDir: 'dist'
  }
});
