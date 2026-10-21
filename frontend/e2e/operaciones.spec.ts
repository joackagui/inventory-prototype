import { expect, type Page, test } from '@playwright/test'
import { abrir, sembrar, sinErroresDeConsola } from './comun'

test.describe.configure({ mode: 'serial' })
test.beforeAll(sembrar)
test.afterAll(sinErroresDeConsola)

const resultado = (p: Page) => p.getByTestId('resultado-operacion')

test('a. PV-014: pedido sin stock muestra el faltante; uno que alcanza reserva; ALM-LP lo despacha con FIFO', async ({ browser }) => {
  const pv = await browser.newPage()
  await abrir(pv, '/operaciones?tipo=pedidos&almacen=CD-LP-01', 'PV-014')
  await pv.getByLabel('Artículo 1').selectOption('ART-10035')
  await expect(pv.getByText('Vendible hoy: 20')).toBeVisible()
  await pv.getByLabel('Cantidad 1').fill('30')
  await pv.getByRole('button', { name: 'Crear pedido y reservar' }).click()
  await expect(pv.getByTestId('faltantes')).toContainText('quedó pendiente de revisión')
  await expect(pv.getByTestId('faltante')).toHaveText('10')
  await pv.getByLabel('Cantidad 1').fill('15')
  await pv.getByRole('button', { name: 'Crear pedido y reservar' }).click()
  await expect(resultado(pv)).toContainText('confirmado: stock reservado')
  const numero = (await resultado(pv).locator('h2').textContent())!.match(/PS-\d+/)![0]

  const alm = await browser.newPage()
  await abrir(alm, '/operaciones?tipo=pedidos', 'ALM-LP')
  await alm.locator(`[data-pedido="${numero}"]`).getByRole('button', { name: 'Despachar' }).click()
  await expect(resultado(alm)).toContainText(`Pedido ${numero} despachado con FIFO`)
  // Dos capas de 10: FIFO saca 10 de la más antigua y 5 de la siguiente.
  await expect(alm.getByTestId('capas-consumidas')).toContainText('10 × 14.10 = USD 141.00')
  await expect(alm.getByTestId('capas-consumidas')).toContainText('5 × 14.24 = USD 71.20')
})

test('b. pedido de 600 del ART-10021: AL01 al reservar y despacho FIFO 12.40/12.52 con su costo', async ({ page }) => {
  await abrir(page, '/operaciones?tipo=pedidos&almacen=CD-LP-01', 'LOG-01')
  await page.getByLabel('Artículo 1').selectOption('ART-10021')
  await page.getByLabel('Cantidad 1').fill('600')
  await page.getByRole('button', { name: 'Crear pedido y reservar' }).click()
  await expect(resultado(page).locator('[data-efecto="creada"][data-codigo="AL01"]')).toContainText('ART-10021')
  const numero = (await resultado(page).locator('h2').textContent())!.match(/PS-\d+/)![0]
  await page.locator(`[data-pedido="${numero}"]`).getByRole('button', { name: 'Despachar' }).click()
  const capas = page.getByTestId('capas-consumidas')
  await expect(capas.locator('[data-lote]')).toHaveCount(2)
  await expect(capas).toContainText('360 × 12.40 = USD 4,464.00')
  await expect(capas).toContainText('240 × 12.52 = USD 3,004.80')
  await expect(page.getByTestId('costo-total')).toHaveText('USD 7,468.80')
})

test('c. traslado desde la propuesta: despacho, recepción con diferencia, ajuste aprobado y tránsito en cero', async ({ browser }) => {
  const log = await browser.newPage()
  await abrir(log, '/operaciones?tipo=traslados&almacen=CD-LP-01', 'LOG-01')
  const fila = log.getByTestId('propuestas').locator('li', { hasText: 'ART-10035' }).first()
  await fila.getByRole('button', { name: 'Crear traslado' }).click()
  await log.getByLabel('Cantidad a trasladar').fill('100')
  await expect(log.getByTestId('vista-previa-traslado')).toContainText('pasaría de posición')
  await log.getByRole('button', { name: 'Emitir traslado' }).click()
  await expect(resultado(log)).toContainText('emitido')
  const ot = (await resultado(log).locator('h2').textContent())!.match(/OT-\d{4}-\d+/)![0]

  const sc = await browser.newPage()
  await abrir(sc, '/operaciones?tipo=traslados', 'ALM-SC')
  await sc.locator(`[data-traslado="${ot}"]`).getByRole('button', { name: /Despachar desde/ }).click()
  await expect(resultado(sc)).toContainText(`Traslado ${ot} despachado al tránsito`)
  await expect(sc.getByTestId('capas-consumidas')).toBeVisible()

  const lp = await browser.newPage()
  await abrir(lp, '/operaciones?tipo=traslados', 'ALM-LP')
  await lp.locator(`[data-traslado="${ot}"]`).getByRole('button', { name: /Recibir en/ }).click()
  await lp.getByLabel('Recibido ART-10035').fill('95')
  await expect(lp.getByTestId('aviso-diferencia')).toContainText('Diferencia de 5')
  await lp.getByRole('button', { name: 'Confirmar recepción' }).click()
  await expect(resultado(lp)).toContainText('recibido con diferencia')
  await expect(resultado(lp).locator('[data-efecto="creada"][data-codigo="AL09"]')).toBeVisible()

  await log.goto('/aprobaciones')
  await log.getByTestId('bandeja-diferencias').getByRole('button').first().click()
  await expect(log.getByTestId('detalle-ajuste')).toContainText(ot)
  await log.getByRole('button', { name: 'Aprobar' }).click()
  await expect(resultado(log)).toContainText('aprobado')
  await log.goto('/articulos/ART-10035')
  await expect(log.getByTestId('posicion-CD-LP-01')).toContainText('Tránsito 0')
})

test('d. conteo ciego con diferencia: ALM-LP no aprueba; LOG-01 sí', async ({ browser }) => {
  const alm = await browser.newPage()
  await abrir(alm, '/operaciones?tipo=conteo&articulo=ART-10021', 'ALM-LP')
  await expect(alm.getByText('no se muestra el saldo del sistema')).toBeVisible()
  await alm.getByLabel('Cantidad contada').fill('474') // sistema en PICK-A: 1,080 − 600 despachadas = 480
  await alm.getByRole('button', { name: 'Registrar conteo' }).click()
  await expect(resultado(alm)).toContainText('Conteo registrado con diferencia')
  await expect(resultado(alm)).toContainText('480')
  const enlace = alm.getByTestId('enlace-ajuste')
  const ruta = (await enlace.getAttribute('href'))!
  await enlace.click()
  await expect(alm.getByText('Tu rol no tiene acceso a esta sección')).toBeVisible()

  const log = await browser.newPage()
  await abrir(log, ruta, 'LOG-01')
  await expect(log.getByTestId('detalle-ajuste')).toContainText('Diferencia de conteo')
  await log.getByRole('button', { name: 'Aprobar' }).click()
  await expect(resultado(log)).toContainText('aprobado')
  await expect(log.getByTestId('capas-consumidas')).toContainText('6 × 12.52')
})

test('e. cuarentena parcial de la capa de 12 días del ART-10063 y liberación por LOG-01', async ({ browser }) => {
  const alm = await browser.newPage()
  await abrir(alm, '/operaciones?tipo=cuarentena', 'ALM-LP')
  await alm.getByTestId('capas-disponibles').locator('[data-lote="LP-10063-270113"]').click()
  await alm.getByLabel('Cantidad a cuarentena').fill('15')
  await expect(alm.getByText('Movimiento parcial: la capa se divide')).toBeVisible()
  await alm.getByRole('button', { name: 'Mover a CUAR-01' }).click()
  await expect(resultado(alm)).toContainText('la capa se dividió')
  await expect(alm.getByTestId('capas-cuarentena').locator('[data-lote="LP-10063-270113"]')).toBeVisible()
  await expect(alm.getByRole('button', { name: 'Liberar' })).toHaveCount(0)

  const log = await browser.newPage()
  await abrir(log, '/operaciones?tipo=cuarentena&almacen=CD-LP-01', 'LOG-01')
  await log.getByTestId('capas-cuarentena').getByRole('button', { name: 'Liberar' }).click()
  await expect(resultado(log)).toContainText('Capa LP-10063-270113 liberada')
})

test('f. envases: devolución parcial y rechazo de devolver de más', async ({ page }) => {
  await abrir(page, '/operaciones?tipo=envases', 'ALM-LP')
  await page.getByLabel('Artículo', { exact: true }).selectOption('ART-10021')
  await page.getByLabel('Cantidad de envases').fill('10')
  await page.getByRole('button', { name: 'Registrar devolución' }).click()
  await expect(resultado(page)).toContainText('30') // Cliente 001: 40 pendientes − 10
  await page.getByLabel('Cantidad de envases').fill('100')
  await page.getByRole('button', { name: 'Registrar devolución' }).click()
  await expect(page.getByTestId('error-envases')).toContainText('No se puede devolver más de lo entregado')
})

test('g. SUP-01 propone una promoción y LOG-01 la aprueba con la referencia del correo', async ({ browser }) => {
  const sup = await browser.newPage()
  await abrir(sup, '/operaciones?tipo=promociones', 'SUP-01')
  await sup.getByLabel('Nombre de la promoción').fill('Pack Pepsi de regalo')
  await sup.getByLabel('Artículo', { exact: true }).selectOption('ART-20011')
  await sup.getByLabel('Hasta').fill('2027-07-31')
  await sup.getByLabel('Tope de cajas').fill('50')
  await sup.getByRole('button', { name: 'Proponer promoción' }).click()
  await expect(resultado(sup)).toContainText('propuesta')

  const log = await browser.newPage()
  await abrir(log, '/aprobaciones', 'LOG-01')
  await expect(log.getByTestId('contador-promociones')).toHaveText('1 promociones propuestas')
  await log.getByTestId('bandeja-promociones').getByRole('button').first().click()
  await log.getByLabel('Referencia del correo').fill('CORREO-GLV-2027-0412')
  await log.getByRole('button', { name: 'Aprobar' }).click()
  await expect(resultado(log)).toContainText('aprobada')
  await expect(resultado(log)).toContainText('CORREO-GLV-2027-0412')
})

test('h. recepción con costo +18%: advierte AL13 y crea la alerta roja', async ({ page }) => {
  await abrir(page, '/operaciones?tipo=recepcion&articulo=ART-10022', 'ALM-LP')
  await page.getByLabel('Cantidad').fill('10')
  await page.getByLabel('Costo unitario').fill('17.46') // última capa 14.79 → +18%
  await expect(page.getByTestId('aviso-costo')).toContainText('AL13 crítico')
  await page.getByRole('button', { name: 'Registrar recepción' }).click()
  await expect(resultado(page).locator('[data-efecto="creada"][data-codigo="AL13"]')).toBeVisible()
})
