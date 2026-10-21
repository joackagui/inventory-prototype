import { expect, test } from '@playwright/test'
import { abrir, sembrar, sinErroresDeConsola } from './comun'

test.describe.configure({ mode: 'serial' })
test.beforeAll(sembrar)
test.afterAll(sinErroresDeConsola)

test('i. LOG-01 filtra AL04, abre el detalle y atiende una alerta', async ({ page }) => {
  await abrir(page, '/alertas', 'LOG-01')
  await expect(page.getByTestId('pildora-sinAtender')).toHaveText('19 sin atender')
  await page.getByLabel('Tipo de alerta').selectOption('VENCIMIENTO')
  const filas = page.getByTestId('fila-alerta')
  await expect(filas).toHaveCount(2)
  for (const codigo of await filas.evaluateAll((f) => f.map((x) => x.getAttribute('data-codigo')))) expect(codigo).toBe('AL04')
  await filas.first().click()
  const panel = page.getByTestId('panel-alerta')
  await expect(panel.getByTestId('medidor')).toBeVisible()
  await expect(panel.getByText('Lote LP-10063-270113 (40 u.) con 12 días de vida ≤ 15: ya no se despacha.').first()).toBeVisible()
  await panel.getByLabel('Resultado').selectOption('Lote en liquidación o cuarentena')
  await panel.getByLabel('Comentario (opcional)').fill('Pasa a cuarentena hoy')
  await panel.getByRole('button', { name: 'Atender alerta' }).click()
  await expect(page.getByText('Alerta atendida')).toBeVisible()
  await expect(panel.getByText(/Atendida por LOG-01/)).toBeVisible()
  await expect(page.getByTestId('pildora-sinAtender')).toHaveText('18 sin atender')
})

test('ii. ALM-LP solo ve alertas de CD-LP-01 y no atiende las que no le corresponden', async ({ page }) => {
  await abrir(page, '/alertas', 'ALM-LP')
  const filas = page.getByTestId('fila-alerta')
  await expect(filas).toHaveCount(13)
  expect(new Set(await filas.evaluateAll((f) => f.map((x) => x.getAttribute('data-almacen'))))).toEqual(new Set(['CD-LP-01']))
  await expect(page.getByTestId('pildora-vigentes')).toHaveText('13 vigentes')
  // AL01 es de R07: el formulario explica por qué no puede atenderla.
  await page.getByLabel('Tipo de alerta').selectOption('REPOSICION')
  await filas.filter({ hasText: 'AL01' }).first().click()
  await expect(page.getByRole('note')).toHaveText('Solo la atiende R07.')
  await expect(page.getByRole('button', { name: 'Atender alerta' })).toBeDisabled()
})

test('iii. ficha del ART-10021: 3 capas, ROP 420 con la fórmula y la próxima en salir', async ({ page }) => {
  await abrir(page, '/articulos/ART-10021', 'LOG-01')
  const capas = page.getByTestId('capas-CD-LP-01')
  await expect(capas.locator('[data-costo]')).toHaveText(['12.40', '12.52', '12.65'])
  await expect(capas.getByTestId('fila-capa').first()).toContainText('Próxima en salir')
  await expect(page.getByTestId('parametros-CD-LP-01').locator('[data-param="rop"]')).toHaveText('420')
  await expect(page.getByTestId('formulas-CD-LP-01')).toContainText('ROP = d × L + SS = 120 × 3 + 60 = 420')
  await expect(page.getByTestId('formulas-CD-LP-01')).toContainText('SS = Z × σd × √L = 2.05 × 17 × √3 = 60')
  await expect(page.getByTestId('costo-fifo')).toHaveText('USD 12.40')
})

test('iv. LOG-01 edita parámetros: la vista previa cambia sin guardar; al guardar cambia el ROP y las alertas', async ({ page }) => {
  await abrir(page, '/articulos/ART-10021', 'LOG-01')
  await page.getByRole('button', { name: 'Editar parámetros de Planta y CD La Paz' }).click()
  const dialogo = page.getByTestId('dialogo-parametros')
  await dialogo.getByLabel('Demanda diaria d').fill('400')
  await expect(dialogo.locator('[data-nuevo="rop"]')).toHaveText('1,260') // 400 × 3 + 60
  // Aún sin guardar: la tabla de la ficha sigue igual.
  await expect(page.getByTestId('parametros-CD-LP-01').locator('[data-param="rop"]')).toHaveText('420')
  await dialogo.getByRole('button', { name: 'Guardar cambios' }).click()
  await dialogo.getByRole('button', { name: 'Confirmar y guardar' }).click()
  await expect(page.getByText(/Parámetros de ART-10021 en .*La Paz guardados/)).toBeVisible()
  await expect(page.getByTestId('parametros-CD-LP-01').locator('[data-param="rop"]')).toHaveText('1,260')
  // Posición 920 ≤ ROP 1,260: aparece AL01 en la tarjeta de La Paz.
  await expect(page.getByTestId('posicion-CD-LP-01')).toContainText('AL01')
})

test('v. PV-014 solo ve la disponibilidad', async ({ page }) => {
  await abrir(page, '/articulos/ART-10021', 'PV-014')
  await expect(page.getByTestId('disponibilidad')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Capas FIFO' })).toHaveCount(0)
  await expect(page.getByText(/USD/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Crear pedido' })).toHaveAttribute('href', '/operaciones?tipo=pedidos&articulo=ART-10021')
})

test('vi. ART-10063: la capa de 12 días no es despachable y sale la de 25', async ({ page }) => {
  await abrir(page, '/articulos/ART-10063', 'LOG-01')
  const filas = page.getByTestId('capas-CD-LP-01').getByTestId('fila-capa')
  await expect(filas.first()).toContainText('No despachable · Menos de 15 días de vida')
  await expect(filas.nth(1)).toContainText('Próxima en salir')
  await expect(page.getByTestId('capas-CD-LP-01').getByTestId('cola-fifo').locator('[data-proxima]')).toHaveAttribute('data-capa', 'LP-10063-270126')
})
