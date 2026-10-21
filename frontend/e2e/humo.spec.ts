import { expect, type Page, test } from '@playwright/test'

const CAPTURAS = '../docs/capturas'

// Errores de consola o de página durante la prueba: deben quedar en cero.
const errores: string[] = []
const vigilar = (pagina: Page) => {
  pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  pagina.on('pageerror', (e) => errores.push(e.message))
}

async function abrir(pagina: Page, usuario: string, tema: 'claro' | 'oscuro' = 'claro') {
  vigilar(pagina)
  await pagina.addInitScript(
    ([u, t]) => {
      localStorage.setItem('cbn.usuario', u)
      localStorage.setItem('cbn.tema', t)
      localStorage.setItem('cbn.almacen', 'TODOS')
    },
    [usuario, tema],
  )
  await pagina.goto('/tablero')
}

async function esperarTablero(pagina: Page) {
  await expect(pagina.getByTestId('alertas-vigentes')).toBeVisible()
  await expect(pagina.locator('.recharts-surface').first()).toBeVisible()
  await pagina.waitForLoadState('networkidle')
  await pagina.waitForTimeout(800) // fin de las animaciones de entrada
}

test.describe.configure({ mode: 'serial' })

test('ALM-LP ve el tablero con las 19 alertas vigentes del estado base', async ({ page }) => {
  await abrir(page, 'ALM-LP')
  await esperarTablero(page)
  await expect(page.getByTestId('alertas-vigentes')).toHaveText('19')
  await expect(page.getByTestId('fecha-simulada')).toHaveText('30/06/2027')
  // R06 no cambia la fecha simulada.
  await expect(page.getByRole('button', { name: 'Avanzar 1 día' })).toHaveCount(0)
  await expect(page.locator('[data-kpi="Valor del inventario"]')).toHaveText(/^USD /)
})

test('capturas del tablero (1920×1080 claro y oscuro, 1366×768 claro)', async ({ browser }) => {
  for (const [ancho, alto, tema] of [
    [1920, 1080, 'claro'],
    [1920, 1080, 'oscuro'],
    [1366, 768, 'claro'],
  ] as const) {
    const contexto = await browser.newContext({ viewport: { width: ancho, height: alto } })
    const pagina = await contexto.newPage()
    await abrir(pagina, 'LOG-01', tema)
    await esperarTablero(pagina)
    await pagina.screenshot({ path: `${CAPTURAS}/tablero-${ancho}x${alto}-${tema}.png` })
    await contexto.close()
  }
})

test('LOG-01: 19 alertas, +5 días cambia el contador y se restablece', async ({ page }) => {
  await abrir(page, 'LOG-01')
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
  await abrir(page, 'LOG-01')
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
  // Una ruta sin permiso muestra el aviso, no datos.
  // Navegación del lado del cliente: page.goto repetiría el script inicial y volvería a LOG-01.
  await page.evaluate(() => {
    history.pushState({}, '', '/costos')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByText('Tu rol no tiene acceso a esta sección')).toBeVisible()
})

test.afterAll(() => {
  expect(errores, `errores en la consola del navegador:\n${errores.join('\n')}`).toEqual([])
})
