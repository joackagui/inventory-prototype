import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Crea y migra la base inventario_test; cada archivo la vuelve a sembrar.
    globalSetup: ['test/configuracion-global.ts'],
    setupFiles: ['test/preparar-entorno.ts'],
    // Los archivos comparten la base de pruebas: uno a la vez.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
