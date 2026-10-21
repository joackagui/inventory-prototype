import { type Page, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

// Escenario del 30/06/2027 desde cero: cada archivo de pruebas empieza igual, sin depender del orden.
export const sembrar = () => execSync('npm --prefix ../backend run db:seed', { stdio: 'ignore' })

// Errores de consola o de página durante la prueba: deben quedar en cero.
export const errores: string[] = []
function vigilar(pagina: Page) {
  // Un 400/403/409 esperado (pedido sin stock, devolver de más) o el 503 mientras se restablecen los datos lo registra el navegador como error de red: no es un error de la app.
  pagina.on('console', (m) => m.type() === 'error' && !/Failed to load resource: the server responded with a status of (400|403|409|503)/.test(m.text()) && errores.push(m.text()))
  pagina.on('pageerror', (e) => errores.push(e.message))
}

export async function abrir(pagina: Page, ruta: string, usuario: string, tema: 'claro' | 'oscuro' = 'claro', almacen = 'TODOS') {
  vigilar(pagina)
  await pagina.addInitScript(
    ([u, t, a]) => {
      localStorage.setItem('cbn.usuario', u)
      localStorage.setItem('cbn.tema', t)
      localStorage.setItem('cbn.almacen', a)
    },
    [usuario, tema, almacen],
  )
  await pagina.goto(ruta)
}

// Navegación del lado del cliente: page.goto repetiría el script inicial (usuario, tema).
export async function irA(pagina: Page, ruta: string) {
  await pagina.evaluate((r) => {
    history.pushState({}, '', r)
    dispatchEvent(new PopStateEvent('popstate'))
  }, ruta)
}

export async function sinErroresDeConsola() {
  expect(errores, `errores en la consola del navegador:\n${errores.join('\n')}`).toEqual([])
}
