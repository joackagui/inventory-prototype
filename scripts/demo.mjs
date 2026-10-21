#!/usr/bin/env node
// `npm run demo:iniciar` y `npm run demo:detener`: levantan y apagan toda la demo (PostgreSQL, backend y frontend).
// Los procesos quedan en segundo plano; sus registros y PID se guardan en .demo/ (carpeta ignorada por Git).
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(import.meta.dirname, '..')
const DEMO = join(RAIZ, '.demo')
const URL_API = 'http://localhost:3000/api/salud'
const URL_WEB = 'http://localhost:5173'

const paso = (t) => console.log(`\n▶ ${t}`)
const ok = (t) => console.log(`  ✔ ${t}`)
function fallar(t, ayuda = []) {
  console.error(`\n✖ ${t}`)
  for (const a of ayuda) console.error(`  · ${a}`)
  process.exit(1)
}
// Ejecuta un comando y muestra su salida solo si falla.
function correr(comando, args, { cwd = RAIZ, mensaje } = {}) {
  const r = spawnSync(comando, args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) fallar(mensaje ?? `Falló: ${comando} ${args.join(' ')}`, (r.stdout + r.stderr).trim().split('\n').slice(-15))
  return r.stdout
}
const responde = async (url) => {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}
async function esperar(url, segundos) {
  for (let i = 0; i < segundos; i++) {
    if (await responde(url)) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}
const pidDe = (nombre) => {
  try {
    return Number(readFileSync(join(DEMO, `${nombre}.pid`), 'utf8'))
  } catch {
    return null
  }
}
const vivo = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
// Proceso desacoplado en su propio grupo, con su registro en .demo/<nombre>.log.
function lanzar(nombre, comando, args, cwd) {
  const log = openSync(join(DEMO, `${nombre}.log`), 'w')
  const hijo = spawn(comando, args, { cwd, detached: true, stdio: ['ignore', log, log] })
  hijo.unref()
  writeFileSync(join(DEMO, `${nombre}.pid`), String(hijo.pid))
}

async function iniciar() {
  console.log('Inventario CBN · preparando la demo (tarda 1 o 2 minutos la primera vez)')
  mkdirSync(DEMO, { recursive: true })

  paso('Revisando Docker')
  if (spawnSync('docker', ['--version']).error) fallar('No encontré Docker en este equipo.', ['Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/ y vuelve a ejecutar: npm run demo:iniciar'])
  if (spawnSync('docker', ['info']).status !== 0)
    fallar('Docker está instalado pero no está abierto.', ['Abre la aplicación Docker Desktop (Cmd + Espacio, escribe «Docker» y presiona Enter).', 'Espera a que el ícono de la ballena deje de moverse y vuelve a ejecutar: npm run demo:iniciar'])
  ok('Docker está abierto')

  if (!existsSync(join(RAIZ, '.env'))) {
    copyFileSync(join(RAIZ, '.env.example'), join(RAIZ, '.env'))
    ok('Creé .env a partir de .env.example')
  }
  for (const carpeta of ['backend', 'frontend']) {
    if (!existsSync(join(RAIZ, carpeta, 'node_modules'))) {
      paso(`Instalando dependencias de ${carpeta} (solo la primera vez)`)
      correr('npm', ['install'], { cwd: join(RAIZ, carpeta) })
    }
  }

  paso('Levantando PostgreSQL')
  correr('docker', ['compose', 'up', '-d', '--wait'], { mensaje: 'No pude levantar PostgreSQL. ¿Hay otra base usando el puerto 5432?' })
  ok('PostgreSQL listo en el puerto 5432')

  paso('Aplicando migraciones y sembrando el escenario del 30/06/2027')
  correr('npx', ['prisma', 'migrate', 'deploy'], { cwd: join(RAIZ, 'backend') })
  const semilla = correr('npm', ['run', 'db:seed'], { cwd: join(RAIZ, 'backend') })
  ok(semilla.match(/Seed listo: (.*)/)?.[1] ?? 'escenario sembrado')
  ok(semilla.match(/Alertas abiertas.*/)?.[0] ?? 'alertas evaluadas')

  paso('Compilando backend y frontend')
  correr('npm', ['run', 'build'], { cwd: join(RAIZ, 'backend') })
  correr('npm', ['run', 'build'], { cwd: join(RAIZ, 'frontend') })
  ok('Compilación lista')

  paso('Iniciando el backend y el frontend en segundo plano')
  for (const [nombre, url] of [
    ['backend', URL_API],
    ['frontend', URL_WEB],
  ]) {
    const pid = pidDe(nombre)
    if (pid && vivo(pid)) fallar(`El ${nombre} de una demo anterior sigue encendido.`, ['Ejecuta primero: npm run demo:detener'])
    if (await responde(url)) fallar(`Ya hay algo respondiendo en ${url}.`, ['Cierra la terminal donde corre (npm run backend:dev / frontend:dev) o presiona Ctrl + C en ella.'])
  }
  lanzar('backend', 'node', ['dist/main.js'], join(RAIZ, 'backend'))
  if (!(await esperar(URL_API, 60))) fallar('El backend no respondió en 60 segundos.', ['Revisa el registro: .demo/backend.log'])
  ok('Backend en http://localhost:3000/api (Swagger en /api/docs)')
  lanzar('frontend', 'npx', ['vite', 'preview', '--port', '5173', '--strictPort'], join(RAIZ, 'frontend'))
  if (!(await esperar(URL_WEB, 30))) fallar('El frontend no respondió en 30 segundos.', ['Revisa el registro: .demo/frontend.log'])
  ok(`Frontend en ${URL_WEB}`)

  const integridad = await (await fetch('http://localhost:3000/api/integridad', { headers: { 'X-Usuario': 'TI-01' } })).json().catch(() => null)
  ok(integridad?.ok ? `Integridad OK (${integridad.capas} capas)` : 'No pude confirmar la integridad: revisa Administración')

  if (!process.env.DEMO_SIN_ABRIR) spawnSync('open', [URL_WEB]) // las pruebas automáticas no abren el navegador
  console.log(`\n✅ Demo lista: ${URL_WEB} (fecha simulada 30/06/2027, usuario LOG-01).`)
  console.log('   Guion: docs/GUION_DEMO.md · Para apagar todo: npm run demo:detener\n')
}

async function detener() {
  console.log('Inventario CBN · apagando la demo')
  for (const nombre of ['frontend', 'backend']) {
    const pid = pidDe(nombre)
    if (pid && vivo(pid)) {
      process.kill(-pid, 'SIGTERM') // todo el grupo: npx y vite, o node
      for (let i = 0; i < 20 && vivo(pid); i++) await new Promise((r) => setTimeout(r, 250))
      if (vivo(pid)) process.kill(-pid, 'SIGKILL')
      ok(`${nombre} detenido`)
    } else ok(`${nombre}: no estaba encendido`)
    rmSync(join(DEMO, `${nombre}.pid`), { force: true })
  }
  if (spawnSync('docker', ['info']).status === 0) {
    correr('docker', ['compose', 'stop'])
    ok('PostgreSQL detenido (los datos se conservan)')
  } else ok('Docker no está abierto: PostgreSQL ya estaba apagado')
  console.log('\n✅ Listo. Para volver a empezar: npm run demo:iniciar\n')
}

const accion = process.argv[2]
if (accion === 'iniciar') await iniciar()
else if (accion === 'detener') await detener()
else fallar('Uso: node scripts/demo.mjs iniciar|detener')
