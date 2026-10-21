import { type Browser, expect, type Page, test } from '@playwright/test'
import { abrir, sembrar, sinErroresDeConsola } from './comun'

// Recorrido completo del guion (docs/GUION_DEMO.md), escena por escena y con los números exactos.
// Empieza sembrando y termina con «Restablecer datos»: deja el estado base del 30/06/2027.
// Las capturas de docs/capturas/recorrido/ se toman solo con `npm run capturas` (CAPTURAS=1).
const CAPTURAS = process.env.CAPTURAS === '1'
const API = 'http://localhost:3000/api'

test.describe.configure({ mode: 'serial' })
test.setTimeout(240_000)
test.beforeAll(sembrar)
test.afterAll(sinErroresDeConsola)

const errores5xx: string[] = []
let restableciendo = false
const paginas: Page[] = []

// Una pestaña por usuario, a 1366×768 (el proyector), vigilando respuestas 5xx.
async function como(browser: Browser, usuario: string, ruta: string, almacen = 'TODOS') {
  const pagina = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  pagina.on('response', (r) => r.status() >= 500 && !(restableciendo && r.status() === 503) && errores5xx.push(`${r.status()} ${r.url()}`))
  await abrir(pagina, ruta, usuario, 'claro', almacen)
  paginas.push(pagina)
  return pagina
}
async function captura(pagina: Page, nombre: string) {
  if (!CAPTURAS) return
  await pagina.waitForLoadState('networkidle')
  await pagina.waitForTimeout(600)
  await pagina.screenshot({ path: `../docs/capturas/recorrido/${nombre}.png` })
}
const resultado = (p: Page) => p.getByTestId('resultado-operacion')

test('recorrido completo de la demo @recorrido', async ({ browser }) => {
  // 1. Tablero
  const log = await como(browser, 'LOG-01', '/tablero')
  await expect(log.getByTestId('alertas-vigentes')).toHaveText('19')
  await expect(log.getByTestId('campana-contador')).toHaveText('5')
  await expect(log.getByTestId('fecha-simulada')).toHaveText('30/06/2027')
  await expect(log.getByTestId('celda-CD-LP-01-ART-10048')).toContainText('AL02')
  await expect(log.locator('.recharts-surface').first()).toBeVisible()
  await captura(log, '01-tablero')

  // 2. Centro de alertas: 19 sin atender, AL04 con su medidor
  await log.goto('/alertas')
  await expect(log.getByTestId('pildora-sinAtender')).toHaveText('19 sin atender')
  await expect(log.getByTestId('pildora-rojas')).toHaveText('5 rojas')
  await expect(log.getByTestId('pildora-amarillas')).toHaveText('11 amarillas')
  await log.getByLabel('Tipo de alerta').selectOption('VENCIMIENTO')
  await expect(log.getByTestId('fila-alerta')).toHaveCount(2)
  await log.getByTestId('fila-alerta').first().click()
  await expect(log.getByTestId('panel-alerta').getByTestId('medidor')).toBeVisible()
  await expect(log.getByTestId('panel-alerta')).toContainText('Lote LP-10063-270113 (40 u.) con 12 días de vida ≤ 15')
  await captura(log, '02-alertas')
  await log.keyboard.press('Escape')

  // 3. Ficha del ART-10021: capas 12.40 / 12.52 / 12.65 y ROP = 120 × 3 + 60 = 420
  await log.goto('/articulos/ART-10021')
  await expect(log.getByTestId('capas-CD-LP-01').locator('[data-costo]')).toHaveText(['12.40', '12.52', '12.65'])
  await expect(log.getByTestId('parametros-CD-LP-01').locator('[data-param="rop"]')).toHaveText('420')
  await expect(log.getByTestId('formulas-CD-LP-01')).toContainText('ROP = d × L + SS = 120 × 3 + 60 = 420')
  await expect(log.getByTestId('formulas-CD-LP-01')).toContainText('SS = Z × σd × √L = 2.05 × 17 × √3 = 60')
  await expect(log.getByTestId('costo-fifo')).toHaveText('USD 12.40')
  await log.getByTestId('capas-CD-LP-01').scrollIntoViewIfNeeded()
  await captura(log, '03-ficha')

  // 4. Pedido de 600 y despacho FIFO: 360 × 12.40 + 240 × 12.52 = USD 7,468.80; nace AL01
  await log.goto('/operaciones?tipo=pedidos&almacen=CD-LP-01')
  await log.getByLabel('Artículo 1').selectOption('ART-10021')
  await log.getByLabel('Cantidad 1').fill('600')
  await log.getByRole('button', { name: 'Crear pedido y reservar' }).click()
  await expect(resultado(log).locator('[data-efecto="creada"][data-codigo="AL01"]')).toContainText('ART-10021')
  const pedido = (await resultado(log).locator('h2').textContent())!.match(/PS-\d+/)![0]
  await log.locator(`[data-pedido="${pedido}"]`).getByRole('button', { name: 'Despachar' }).click()
  await expect(log.getByTestId('capas-consumidas')).toContainText('360 × 12.40 = USD 4,464.00')
  await expect(log.getByTestId('capas-consumidas')).toContainText('240 × 12.52 = USD 3,004.80')
  await expect(log.getByTestId('costo-total')).toHaveText('USD 7,468.80')
  await captura(log, '04-pedido-despacho')

  // 5. Reposición completa: propuesta → traslado de 100 → despacho SC → recepción de 95 (AL09) → ajuste aprobado
  await log.goto('/operaciones?tipo=traslados&almacen=CD-LP-01')
  await log.getByTestId('propuestas').locator('li', { hasText: 'ART-10035' }).first().getByRole('button', { name: 'Crear traslado' }).click()
  await log.getByLabel('Cantidad a trasladar').fill('100')
  await log.getByRole('button', { name: 'Emitir traslado' }).click()
  await expect(resultado(log)).toContainText('emitido')
  const ot = (await resultado(log).locator('h2').textContent())!.match(/OT-\d{4}-\d+/)![0]
  const sc = await como(browser, 'ALM-SC', '/operaciones?tipo=traslados')
  await sc.locator(`[data-traslado="${ot}"]`).getByRole('button', { name: /Despachar desde/ }).click()
  await expect(resultado(sc)).toContainText(`Traslado ${ot} despachado al tránsito`)
  const lp = await como(browser, 'ALM-LP', '/operaciones?tipo=traslados')
  await lp.locator(`[data-traslado="${ot}"]`).getByRole('button', { name: /Recibir en/ }).click()
  await lp.getByLabel('Recibido ART-10035').fill('95')
  await expect(lp.getByTestId('aviso-diferencia')).toContainText('Diferencia de 5')
  await lp.getByRole('button', { name: 'Confirmar recepción' }).click()
  await expect(resultado(lp).locator('[data-efecto="creada"][data-codigo="AL09"]')).toBeVisible()
  await log.goto('/aprobaciones')
  await log.getByTestId('bandeja-diferencias').getByRole('button').first().click()
  await expect(log.getByTestId('detalle-ajuste')).toContainText(ot)
  await log.getByRole('button', { name: 'Aprobar' }).click()
  await expect(resultado(log)).toContainText('aprobado')
  await captura(log, '05-reposicion-aprobada')

  // 6. Conteo ciego: ALM-LP cuenta 474 en PICK-A (sistema 480 tras el despacho); solo LOG-01 aprueba
  await lp.goto('/operaciones?tipo=conteo&articulo=ART-10021')
  await expect(lp.getByText('no se muestra el saldo del sistema')).toBeVisible()
  await lp.getByLabel('Cantidad contada').fill('474')
  await lp.getByRole('button', { name: 'Registrar conteo' }).click()
  await expect(resultado(lp)).toContainText('Conteo registrado con diferencia')
  await expect(resultado(lp)).toContainText('480')
  const ruta = (await lp.getByTestId('enlace-ajuste').getAttribute('href'))!
  await captura(lp, '06a-conteo-ciego')
  await log.goto(ruta)
  await expect(log.getByTestId('detalle-ajuste')).toContainText('Diferencia de conteo')
  await log.getByRole('button', { name: 'Aprobar' }).click()
  await expect(log.getByTestId('capas-consumidas')).toContainText('6 × 12.52')
  await captura(log, '06b-ajuste-aprobado')

  // 7. Vencimientos: la capa de 12 días del ART-10063 (40 u.) pasa entera a CUAR-01
  await lp.goto('/operaciones?tipo=cuarentena')
  await lp.getByTestId('capas-disponibles').locator('[data-lote="LP-10063-270113"]').click()
  await lp.getByLabel('Cantidad a cuarentena').fill('40')
  await lp.getByRole('button', { name: 'Mover a CUAR-01' }).click()
  await expect(resultado(lp)).toContainText('LP-10063-270113')
  await expect(lp.getByTestId('capas-cuarentena').locator('[data-lote="LP-10063-270113"]')).toBeVisible()
  await captura(lp, '07-cuarentena')

  // 8. Fiestas: aniversario de La Paz, cronograma «3 semanas antes» en curso, ART-10048 crítico (AL14) y traslado extraordinario de 91
  await log.goto('/fiestas')
  await log.locator('[data-fiesta^="Aniversario de La Paz"]').click()
  await expect(log.getByTestId('detalle-fiesta').locator('[data-hito="3-semanas"]')).toHaveAttribute('data-estado', 'EN_CURSO')
  await expect(log.getByTestId('fiesta-CD-LP-01').locator('[data-articulo="ART-10048"]')).toHaveAttribute('data-estado', 'CRITICO')
  await captura(log, '08a-fiestas')
  await log.getByRole('link', { name: 'Crear traslados extraordinarios' }).first().click() // La Paz es la primera tarjeta
  const extra = log.getByTestId('extraordinarios').locator('[data-articulo="ART-10048"]')
  await expect(extra.getByLabel('Cantidad ART-10048')).toHaveValue('91')
  await extra.getByRole('button', { name: 'Emitir' }).click()
  await expect(extra).toContainText('Emitido ✓')
  await captura(log, '08b-traslado-extraordinario')

  // 9. Análisis (ABC: tres artículos A, 74.69% acumulado) y Costos (valores del backend)
  await log.goto('/analisis')
  await expect(log.getByTestId('tabla-abc').locator('tbody tr').nth(2).locator('[data-acumulado]')).toHaveText('74.69%')
  await captura(log, '09a-analisis')
  const costos = await (await log.request.get(`${API}/costos?mes=2027-06`, { headers: { 'X-Usuario': 'LOG-01' } })).json()
  const a21 = costos.articulos.find((x: { codigo: string }) => x.codigo === 'ART-10021')
  expect(a21.unidadesVendidas).toBeGreaterThanOrEqual(7500)
  await log.goto('/costos')
  await expect(log.getByTestId('nota-documento')).toContainText(`${a21.unidadesVendidas.toLocaleString('en-US')} cajas`)
  await captura(log, '09b-costos')

  // 10. Administración: integridad en ✔ y restablecer datos → 30/06/2027 con 19 alertas
  const ti = await como(browser, 'TI-01', '/administracion')
  await ti.getByRole('button', { name: 'Verificar integridad' }).click()
  await expect(ti.getByTestId('tabla-integridad').locator('tbody tr')).toHaveCount(6)
  await expect(ti.getByTestId('tabla-integridad').locator('[data-ok="false"]')).toHaveCount(0)
  await captura(ti, '10a-integridad')
  restableciendo = true
  await ti.getByRole('button', { name: 'Restablecer datos' }).click()
  await ti.getByLabel('Confirmación').fill('RESTABLECER')
  await ti.getByTestId('dialogo-restablecer').getByRole('button', { name: 'Restablecer datos' }).click()
  await expect(ti.getByTestId('resultado-restablecer')).toContainText('30/06/2027, 19 alertas vigentes', { timeout: 60_000 })
  restableciendo = false
  await captura(ti, '10b-restablecido')
  await log.goto('/tablero')
  await expect(log.getByTestId('alertas-vigentes')).toHaveText('19')

  expect(errores5xx, `respuestas 5xx:\n${errores5xx.join('\n')}`).toEqual([])
  for (const p of paginas) await p.close()
})
