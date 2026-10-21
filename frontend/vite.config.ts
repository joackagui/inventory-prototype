/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'happy-dom',
    setupFiles: ['src/pruebas/preparar.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
