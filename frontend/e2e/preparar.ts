import { execSync } from 'node:child_process'

// Escenario del 30/06/2027 desde cero (el seed deja evaluadas sus 19 alertas).
export default function preparar() {
  execSync('npm --prefix ../backend run db:seed', { stdio: 'ignore' })
}
