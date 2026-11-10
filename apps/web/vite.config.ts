import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [resolve(root, '../..')],
    },
    proxy: {
      '/chats': 'http://127.0.0.1:3087',
      '/uploads': 'http://127.0.0.1:3087',
      '/socket.io': { target: 'http://127.0.0.1:3087', ws: true },
    },
  },
  preview: {
    proxy: {
      '/chats': 'http://127.0.0.1:3087',
      '/uploads': 'http://127.0.0.1:3087',
      '/socket.io': { target: 'http://127.0.0.1:3087', ws: true },
    },
  },
});
