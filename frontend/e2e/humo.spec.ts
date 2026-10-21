import { expect, type Page, test } from '@playwright/test'
import { abrir, irA, sembrar, sinErroresDeConsola } from './comun'

async function esperarTablero(pagina: Page) {
  await expect(pagina.getByTestId('alertas-vigentes')).toBeVisible()
  await expect(pagina.locator('.recharts-surface').first()).toBeVisible()
}

test.describe.configure({ mode: 'serial' })
test.beforeAll(sembrar)
test.afterAll(sinErroresDeConsola)

test('ALM-LP ve el tablero con las 19 alertas vigentes del estado base', async ({ page }) => {
  await abrir(page, '/tablero', 'ALM-LP')
  await esperarTablero(page)
  await expect(page.getByTestId('alertas-vigentes')).toHaveText('19')
  await expect(page.getByTestId('fecha-simulada')).toHaveText('30/06/2027')
  // R06 no cambia la fecha simulada.
  await expect(page.getByRole('button', { name: 'Avanzar 1 día' })).toHaveCount(0)
  await expect(page.locator('[data-kpi="Valor del inventario"]')).toHaveText(/^USD /)
})

test('LOG-01: 19 alertas, +5 días cambia el contador y se restablece', async ({ page }) => {
  await abrir(page, '/tablero', 'LOG-01')
  await esperarTablero(page)
  await expect(page.getByTestId('alertas-vigentes')).toHaveText('19')
  await expect(page.getByTestId('campana-contador')).toHaveText('5')

  await page.getByLabel('Elegir fecha simulada').fill('2027-07-05')
  await expect(page.getByTestId('fecha-simulada')).toHaveText('05/07/2027')
  await expect(page.getByText('alertas cambiaron')).toBeVisible()
  await expect(page.getByTestId('alertas-vigentes')).toHaveText('25')
  await expect(page.getByTestId('campana-contador')).not.toHaveText('5')

  await page.getByRole('button', { name: 'Restablecer al 30/06/2027' }).click()
  await expect(page.getByTestId('fecha-simulada')).toHaveText('30/06/2027')
  await expect(page.getByTestId('alertas-vigentes')).toHaveText('19')
})

test('al cambiar a PV-014 desaparecen alertas y costos', async ({ page }) => {
  await abrir(page, '/tablero', 'LOG-01')
  await esperarTablero(page)
  await page.getByTestId('selector-usuario').click()
  await page.getByRole('menuitem', { name: /PV-014/ }).click()
  await expect(page.getByTestId('vista-preventista')).toBeVisible()
  await expect(page.getByTestId('alertas-vigentes')).toHaveCount(0)
  await expect(page.getByTestId('campana')).toHaveCount(0)
  await expect(page.getByText(/USD/)).toHaveCount(0)
  const menu = page.getByRole('navigation', { name: 'Secciones' })
  await expect(menu.getByRole('link', { name: 'Alertas' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Costos' })).toHaveCount(0)
  await expect(page.getByText('Agotado').first()).toBeVisible()
  await irA(page, '/costos')
  await expect(page.getByText('Tu rol no tiene acceso a esta sección')).toBeVisible()
})
