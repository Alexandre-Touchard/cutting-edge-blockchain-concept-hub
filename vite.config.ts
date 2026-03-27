import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // When running `vercel dev`, Vercel sets PORT for the framework dev server.
  // Vite does not automatically respect PORT unless configured, so we wire it here.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: true
  }
});
