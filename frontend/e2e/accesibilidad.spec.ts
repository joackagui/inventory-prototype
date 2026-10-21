import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { abrir, sembrar } from './comun'

// axe-core en cada pantalla, en claro y oscuro: ninguna violación seria ni crítica.
const PANTALLAS = [
  ['/tablero', 'LOG-01', 'Tablero'],
  ['/alertas', 'LOG-01', 'Centro de alertas'],
  ['/articulos/ART-10021', 'LOG-01', 'Paceña'],
  ['/operaciones', 'ALM-LP', 'Operaciones'],
  ['/aprobaciones', 'LOG-01', 'Aprobaciones'],
  ['/analisis', 'LOG-01', 'Análisis'],
  ['/fiestas', 'LOG-01', 'Fiestas'],
  ['/costos', 'LOG-01', 'Costos de inventario'],
  ['/administracion', 'TI-01', 'Administración de la demo'],
] as const

test.beforeAll(sembrar)

for (const tema of ['claro', 'oscuro'] as const) {
  for (const [ruta, usuario, titulo] of PANTALLAS) {
    test(`accesibilidad de ${ruta} (${tema})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' }) // sin animaciones de entrada a medio camino
      await abrir(page, ruta, usuario, tema, ruta === '/operaciones' ? 'CD-LP-01' : 'TODOS')
      await expect(page.getByRole('heading', { level: 1 })).toContainText(titulo)
      await page.waitForLoadState('networkidle')
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      const detalle = graves.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join('\n  ')}`).join('\n')
      expect(graves, detalle).toEqual([])
    })
  }
}
