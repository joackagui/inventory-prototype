import { expect, test } from '@playwright/test'
import { abrir, sembrar, sinErroresDeConsola } from './comun'

const API = 'http://localhost:3000/api'
test.describe.configure({ mode: 'serial' })
test.beforeAll(sembrar)
test.afterAll(sinErroresDeConsola)

test('i. Análisis: ART-10021, 10022 y 10035 son clase A (74.69% acumulado en el tercero)', async ({ page }) => {
  await abrir(page, '/analisis', 'LOG-01')
  const filas = page.getByTestId('tabla-abc').locator('tbody tr')
  await expect(filas.nth(0)).toHaveAttribute('data-articulo', 'ART-10021')
  for (const i of [0, 1, 2]) await expect(filas.nth(i)).toHaveAttribute('data-clase', 'A')
  await expect(filas.nth(2).locator('[data-acumulado]')).toHaveText('74.69%')
  await expect(filas.nth(3)).toHaveAttribute('data-clase', 'B') // 84.73%: pasa el 80%
  await expect(page.getByTestId('grafico-pareto')).toHaveAttribute('aria-label', /10035: USD 963.00, 74.7% acumulado, clase A/)
})

test('ii. Fiestas: aniversario de La Paz con hitos y ART-10035 crítico; acercar la fecha cambia el cronograma', async ({ page }) => {
  await abrir(page, '/fiestas', 'LOG-01', 'claro', 'CD-LP-01')
  await page.locator('[data-fiesta^="Aniversario de La Paz"]').click()
  const detalle = page.getByTestId('detalle-fiesta')
  await expect(detalle.locator('[data-hito="3-semanas"]')).toHaveAttribute('data-estado', 'EN_CURSO')
  await expect(page.getByTestId('fiesta-CD-LP-01').locator('[data-articulo="ART-10035"]')).toHaveAttribute('data-estado', 'CRITICO')
  await expect(page.getByTestId('formulas-fiesta')).toContainText('ROP fiesta = d × f × L + SS × f = 45 × 1.3 × 3 + 23 × 1.3 = 205')
  await page.getByRole('button', { name: 'Ver la fiesta como si estuviera cerca' }).click()
  await expect(page.getByTestId('fecha-simulada')).toHaveText('18/06/2027')
  await expect(detalle.locator('[data-hito="3-semanas"]')).toHaveAttribute('data-estado', 'PROXIMO')
  await page.getByRole('button', { name: 'Restablecer al 30/06/2027' }).click()
  await expect(page.getByTestId('fecha-simulada')).toHaveText('30/06/2027')
})

test('iii. Costos: ART-10021 de La Paz en junio con los valores del backend; la tasa cambia la vista previa', async ({ page }) => {
  const r = await page.request.get(`${API}/costos?almacenId=CD-LP-01&mes=2027-06`, { headers: { 'X-Usuario': 'LOG-01' } })
  const a = (await r.json()).articulos.find((x: { codigo: string }) => x.codigo === 'ART-10021')
  const usd = (n: number) => `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  await abrir(page, '/costos', 'LOG-01', 'claro', 'CD-LP-01')
  const fila = page.getByTestId('tabla-costos').locator('[data-articulo="ART-10021"]')
  await expect(fila.locator('[data-adquisicion]')).toHaveText(usd(a.adquisicion))
  await expect(fila.locator('[data-conservacion]')).toHaveText(usd(a.conservacion))
  await page.getByRole('button', { name: 'Parámetros' }).click()
  const previa = page.getByTestId('previa-costos').locator('[data-componente="Conservación"]')
  const antes = await previa.locator('[data-nuevo]').textContent()
  await page.getByLabel('Tasa de conservación anual').fill('0.3')
  await expect(previa.locator('[data-nuevo]')).not.toHaveText(antes!)
  await page.getByRole('button', { name: 'Cancelar' }).click()
})

test('iv. Administración: escenario de vencimientos, integridad en ✔ y restablecer datos', async ({ page }) => {
  await abrir(page, '/administracion', 'LOG-01')
  await page.locator('[data-escenario="vencimientos"]').click()
  await expect(page.getByTestId('fecha-grande')).toHaveText('10/07/2027')
  await expect(page.getByTestId('resultado-fecha')).toContainText('AL04 ART-10063 CD-LP-01: amarillo → rojo')
  await page.getByRole('button', { name: 'Verificar integridad' }).click()
  const filas = page.getByTestId('tabla-integridad').locator('tbody tr')
  await expect(filas).toHaveCount(6)
  await expect(page.getByTestId('tabla-integridad').locator('[data-ok="false"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Restablecer datos' }).click()
  await page.getByLabel('Confirmación').fill('RESTABLECER')
  await page.getByTestId('dialogo-restablecer').getByRole('button', { name: 'Restablecer datos' }).click()
  await expect(page.getByTestId('resultado-restablecer')).toContainText('30/06/2027, 19 alertas vigentes')
  await expect(page.getByTestId('fecha-grande')).toHaveText('30/06/2027')
})

test('v. R01 no accede a Análisis, Fiestas, Costos ni Administración', async ({ page }) => {
  for (const ruta of ['/analisis', '/fiestas', '/costos', '/administracion']) {
    await abrir(page, ruta, 'PV-014')
    await expect(page.getByText('Tu rol no tiene acceso a esta sección')).toBeVisible()
  }
})

test('vi. rechazar una promoción exige comentario', async ({ page }) => {
  await page.request.post(`${API}/promociones`, { headers: { 'X-Usuario': 'SUP-01' }, data: { nombre: 'Promo a rechazar', tipo: 'BONIFICACION', articulo: 'ART-20011', fechaInicio: '2027-07-01', fechaFin: '2027-07-31', topeCajas: 10 } })
  await abrir(page, '/aprobaciones', 'LOG-01')
  await page.getByTestId('bandeja-promociones').getByRole('button').first().click()
  await page.getByRole('button', { name: 'Rechazar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Escribe por qué se rechaza.' })).toBeVisible()
  await page.getByLabel('Comentario').fill('Tope sin stock que lo respalde')
  await page.getByRole('button', { name: 'Rechazar' }).click()
  await expect(page.getByTestId('resultado-operacion')).toContainText('Queda RECHAZADA: Tope sin stock que lo respalde')
})
