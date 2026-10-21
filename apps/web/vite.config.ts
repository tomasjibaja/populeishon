import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // La web llama a /api/...; en desarrollo se reenvía a la API (npm run dev:api), así no hace falta CORS.
    proxy: { '/api': 'http://localhost:3001' },
  },
});
