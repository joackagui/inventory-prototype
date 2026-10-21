import { defineConfig } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Usa el Chromium que ya está en el equipo (caché de Playwright); no descarga navegadores.
function chromiumLocal() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright')
  const dirs = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : []
  for (const d of dirs) {
    for (const ruta of [
      'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      'chrome-linux/chrome',
    ]) {
      if (existsSync(join(cache, d, ruta))) return join(cache, d, ruta)
    }
  }
  return process.env.CHROMIUM_PATH
}

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  timeout: 60_000,
  globalSetup: './e2e/preparar.ts',
  use: { baseURL: 'http://localhost:5173', launchOptions: { executablePath: chromiumLocal() } },
  // Levanta backend y frontend si no están corriendo (reutiliza los que ya estén).
  webServer: [
    { command: 'npm --prefix .. run backend:dev', url: 'http://localhost:3000/api/salud', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
  ],
})
