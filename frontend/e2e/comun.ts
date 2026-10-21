import { type Page, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

// Escenario del 30/06/2027 desde cero: cada archivo de pruebas empieza igual, sin depender del orden.
export const sembrar = () => execSync('npm --prefix ../backend run db:seed', { stdio: 'ignore' })

// Errores de consola o de página durante la prueba: deben quedar en cero.
export const errores: string[] = []
export function vigilar(pagina: Page) {
  pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
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
