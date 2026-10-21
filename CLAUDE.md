# CLAUDE.md — Inventario CBN

## Resumen
Prototipo funcional (demo en vivo en localhost) del sistema de inventarios del ERP de CBN (AB InBev Bolivia, canal de preventa).
Cubre solo inventario: módulo M3 y maestros MD2 (artículos) y MD4 (almacenes).
Mercadería terminada en 3 almacenes (La Paz, Cochabamba, Santa Cruz), sin producción ni compras.
Inventario perpetuo con valoración FIFO por capas (lote, costo, vencimiento).
La reposición es por traslado entre plantas (origen → tránsito → destino).
Calcula SS, ROP, Q, Máx, cobertura y clase ABC en el backend.
16 alertas tipo semáforo (AL01–AL16) evaluadas con una fecha simulada (por defecto 30/06/2027).
Roles genéricos sin login real (selector de usuario); el backend valida permisos por rol.
Datos de muestra en un seed, pero todo se guarda en PostgreSQL y se calcula de verdad.
Todo en español; frontend pensado para proyectarse en vivo.

## Stack
- Backend: Node.js, NestJS (TypeScript, ESM), Prisma 7 con `@prisma/adapter-pg`, PostgreSQL 16.
- Frontend: React 19, Vite, TypeScript, Tailwind CSS 4, react-router-dom, @tanstack/react-query, recharts.
- Infra: Docker Compose (solo PostgreSQL, `postgres:16-alpine`, ARM64).

## Estructura
```
docs/ESPECIFICACION.md   fuente de verdad del proyecto
docs/MODELO_DATOS.md     modelo de datos, motor de inventario, decisiones y escenario del seed
docs/PERMISOS.md         tabla de permisos por rol y endpoint
docs/ALERTAS.md          alertas AL01–AL16: evaluador, umbrales, rol, cuándo se evalúa, ciclo de vida
docker-compose.yml       PostgreSQL 16
.env.example             credenciales de ejemplo (copiar a .env, no se sube)
package.json             scripts de la raíz
backend/
  prisma/                schema.prisma, migraciones, seed.ts (exporta sembrar()), verificar-integridad.ts
  scripts/demo-api.ts    ensayo de la demo por HTTP
  scripts/demo-alertas.ts  ensayo de la demo de alertas
  test/                  tests de integración (*.e2e-spec.ts) sobre la base inventario_test
  src/
    comun/errores.ts     ErrorNegocio y filtro de errores { codigo, mensaje, detalles }
    usuarios/            guard X-Usuario, @Roles, exigirAlmacen; GET /api/usuarios, /api/yo
    simulacion/          fecha simulada y configuración (con bitácora)
    inventario/calculos/ fórmulas puras (SS, ROP, Q, Máx, Z, ABC, fiestas, costos) + tests
    inventario/motor.ts  candados, saldo, consumo FIFO, registro de movimientos, evento inventario.cambio
    inventario/stock.ts  estados del stock (API, seed, integridad)
    inventario/integridad.ts  verificación reutilizable (script, GET /api/integridad, tests)
    inventario/operaciones/   recepción, pedidos, traslados, conteos, ajustes, cuarentena, envases, parámetros
    articulos/ almacenes/ salud/   consultas
    alertas/evaluadores.ts  evaluadores puros AL01–AL16, catálogo de roles y acciones, validación de umbrales (+ tests)
    alertas/evaluacion.ts   evaluación contra la base y ciclo de vida (crear, color, resolver, escalar)
    alertas/             API de alertas, semáforo y umbrales; escucha inventario.cambio y alertas.evaluar
    simulacion/integracion.controller.ts  eventos de integración simulados (AL16)
    inventario/operaciones/promociones.*  promociones propuestas (R02) y aprobadas (R07)
    generated/prisma/    cliente generado (no se sube)
frontend/
  src/                   App.tsx (pantalla de salud), main.tsx (router + React Query)
```

## Comandos principales (desde la raíz)
- `npm run db:up` / `npm run db:down` — iniciar / detener PostgreSQL.
- `npm run install:all` — instalar dependencias de backend y frontend.
- `npm run db:migrate` — aplicar migraciones de Prisma.
- `npm run db:seed` — vaciar y sembrar el escenario del 30/06/2027 (determinista).
- `npm run db:reset` — borrar la base, migrar, sembrar y verificar integridad.
- `npm run db:verificar` — comprobar integridad de capas y movimientos.
- `npm test` — tests unitarios + integración (Vitest, viene con NestJS 12; integración en la base `inventario_test`).
- `npm run demo:api` — ensayo de la demo por HTTP (requiere `npm run backend:dev`).
- `npm run demo:alertas` — ensayo de la demo de alertas (requiere `npm run backend:dev`).
- Swagger: http://localhost:3000/api/docs
- `npm run backend:dev` — backend en http://localhost:3000 (prefijo `/api`).
- `npm run frontend:dev` — frontend en http://localhost:5173.
- `npm --prefix frontend run build` / `npm --prefix backend run build` — compilar.

## Reglas de trabajo
- Idioma: español en código de dominio, mensajes, commits y documentación.
- Git: cambiar de rama siempre con `git checkout` (nunca `git switch`); trabajar en ramas `feature/...` y hacer merge a `main`.
- Commits pequeños, formato `tipo: descripción` (feat, fix, docs, chore).
- No modificar `docs/ESPECIFICACION.md` sin avisar antes al usuario.
- Todos los cálculos (SS, ROP, Q, Máx, FIFO, ABC, alertas, costos) se hacen en el backend; el frontend solo muestra.
- Los movimientos de inventario nunca se borran ni se editan (las correcciones son movimientos nuevos o ajustes). Un trigger en PostgreSQL lo impone; el seed usa TRUNCATE.
- SS, ROP, Q y Máx se obtienen siempre con `calcularParametros()` de `src/inventario/calculos/formulas.ts`; redondeo de SS con Math.round. No duplicar fórmulas en otro lugar.
- El stock físico se mueve solo con los tipos de `TIPOS_FISICOS` (incluye CUARENTENA, con dos patas que suman 0); RESERVA, LIBERACION_RESERVA, CONTEO y ENVASE_* son de control.
- Toda operación que cambia stock: transacción `prisma.$transaction(..., TX)` + `bloquear()` de los pares artículo/almacén antes de leer saldos; consultas secuenciales dentro de la transacción (sin Promise.all); `emitirCambio()` después de confirmar.
- Permisos: cada ruta lleva `@Roles(...)`; las operaciones de almacén llaman `exigirAlmacen()`. Actualizar docs/PERMISOS.md al agregar rutas.
- Errores con `ErrorNegocio(status, CODIGO, 'mensaje en español', detalles)`.
- DTOs en archivos `*.dto.ts` con class-validator y JSDoc `@example` (el plugin de Swagger los lee).
- Cada operación nueva lleva su test de integración y debe dejar `GET /api/integridad` en OK.
- Alertas: la lógica de umbrales va en `alertas/evaluadores.ts` (pura, con tests); los datos y el ciclo de vida, en `alertas/evaluacion.ts`. Una operación nueva que cambia stock solo necesita `await emitirCambio(...)`; algo que dependa del tiempo o sea global emite `EVENTO_EVALUAR`.
- Toda alerta usa la fecha simulada y umbrales de `ConfiguracionSistema.umbralesAlertas`; nunca la fecha real.
- Todo lo que use "hoy" usa la fecha simulada (`SimulacionService`), nunca la fecha real.
- Cambios de esquema: nueva migración en `backend/prisma/migrations` (no editar las aplicadas). Si cambian datos del escenario, actualizar docs/MODELO_DATOS.md y correr `npm run db:reset` + `npm run db:verificar`.
- Prisma bloquea `migrate reset` ejecutado por un agente: pedir permiso explícito al usuario antes de correrlo.

Ver docs/ESPECIFICACION.md para el detalle completo.
