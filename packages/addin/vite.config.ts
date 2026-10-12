import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Office requires HTTPS for task panes; use `E2E=1` to serve plain HTTP for browser tests.
export default defineConfig({
  plugins: [react(), ...(process.env.E2E ? [] : [basicSsl()])],
  server: { port: 3000, proxy: { '/api': 'http://localhost:4000' } },
  preview: { port: 3000, proxy: { '/api': 'http://localhost:4000' } },
});
