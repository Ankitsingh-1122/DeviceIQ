import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: path_root(),
  plugins: [react()],
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: { port: 5173, strictPort: true },
});

function path_root() {
  return 'src/renderer';
}
