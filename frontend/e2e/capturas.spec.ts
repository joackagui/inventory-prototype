import { expect, type Page, test } from '@playwright/test'
import { abrir, sembrar, sinErroresDeConsola } from './comun'

// Solo con `npm run capturas`: regenera las imágenes de docs/capturas (la prueba de humo no las toca).
const CAPTURAS = '../docs/capturas'
const TEMAS = ['claro', 'oscuro'] as const

test.describe.configure({ mode: 'serial' })
test.beforeAll(sembrar)
test.afterAll(sinErroresDeConsola)

async function pausa(pagina: Page) {
  await pagina.waitForLoadState('networkidle')
  await pagina.waitForTimeout(900) // fin de animaciones de entrada
}

test('capturas del tablero @capturas', async ({ browser }) => {
  for (const [ancho, alto, tema] of [[1920, 1080, 'claro'], [1920, 1080, 'oscuro'], [1366, 768, 'claro']] as const) {
    const contexto = await browser.newContext({ viewport: { width: ancho, height: alto } })
    const pagina = await contexto.newPage()
    await abrir(pagina, '/tablero', 'LOG-01', tema)
    await expect(pagina.getByTestId('alertas-vigentes')).toHaveText('19')
    await expect(pagina.locator('.recharts-surface').first()).toBeVisible()
    await pausa(pagina)
    await pagina.screenshot({ path: `${CAPTURAS}/tablero-${ancho}x${alto}-${tema}.png` })
    await contexto.close()
  }
})

test('capturas del Centro de alertas con el panel abierto @capturas', async ({ browser }) => {
  for (const tema of TEMAS) {
    const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const pagina = await contexto.newPage()
    await abrir(pagina, '/alertas', 'LOG-01', tema)
    await pagina.getByTestId('fila-alerta').first().click()
    await expect(pagina.getByTestId('medidor')).toBeVisible()
    await pausa(pagina)
    await pagina.screenshot({ path: `${CAPTURAS}/alertas-panel-1920x1080-${tema}.png` })
    await contexto.close()
  }
})

test('capturas de la ficha del ART-10021 por sección @capturas', async ({ browser }) => {
  for (const tema of TEMAS) {
    const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const pagina = await contexto.newPage()
    await abrir(pagina, '/articulos/ART-10021', 'LOG-01', tema)
    await expect(pagina.getByTestId('cola-fifo').first()).toBeVisible()
    for (const seccion of ['posicion', 'parametros', 'capas', 'kardex']) {
      await pagina.evaluate((id) => document.getElementById(id)?.scrollIntoView(), seccion)
      await pausa(pagina)
      await pagina.screenshot({ path: `${CAPTURAS}/ficha-ART-10021-${seccion}-1920x1080-${tema}.png` })
    }
    await contexto.close()
  }
})

test('capturas de Operaciones y Aprobaciones @capturas', async ({ browser }) => {
  for (const tema of TEMAS) {
    const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const pv = await contexto.newPage()
    await abrir(pv, '/operaciones?tipo=pedidos&almacen=CD-LP-01', 'PV-014', tema)
    await pv.getByLabel('Artículo 1').selectOption('ART-10035')
    await pv.getByLabel('Cantidad 1').fill('30')
    await pv.getByRole('button', { name: 'Crear pedido y reservar' }).click()
    await expect(pv.getByTestId('faltantes')).toBeVisible()
    await pausa(pv)
    await pv.screenshot({ path: `${CAPTURAS}/operaciones-pedido-faltante-1920x1080-${tema}.png` })

    const log = await contexto.newPage()
    await abrir(log, '/operaciones?tipo=pedidos', 'LOG-01', tema)
    await log.locator('[data-pedido]', { hasText: 'CD-LP-01' }).filter({ hasText: 'ART-10021' }).getByRole('button', { name: 'Despachar' }).first().click()
    await expect(log.getByTestId('capas-consumidas')).toBeVisible()
    await log.getByTestId('resultado-operacion').scrollIntoViewIfNeeded()
    await pausa(log)
    await log.screenshot({ path: `${CAPTURAS}/operaciones-despacho-fifo-1920x1080-${tema}.png` })

    await log.goto('/operaciones?tipo=traslados')
    await log.getByRole('tab', { name: 'Seguimiento' }).click()
    await expect(log.getByTestId('seguimiento')).toBeVisible()
    await pausa(log)
    await log.screenshot({ path: `${CAPTURAS}/operaciones-traslados-seguimiento-1920x1080-${tema}.png` })

    await log.goto('/aprobaciones')
    await expect(log.getByTestId('bandeja-ajustes')).toBeVisible()
    await pausa(log)
    await log.screenshot({ path: `${CAPTURAS}/aprobaciones-1920x1080-${tema}.png` })
    await contexto.close()
  }
})
