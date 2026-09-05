import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [
    react(),
    tailwind(),
    {
      name: 'development-csp',
      transformIndexHtml(html) {
        return command === 'serve'
          ? html.replace(
              "script-src 'self'",
              "script-src 'self' 'unsafe-inline'",
            )
          : html;
      },
    },
  ],
  build: { outDir: 'dist/renderer' },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
}));
