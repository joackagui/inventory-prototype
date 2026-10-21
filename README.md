# Inventario CBN — Prototipo

Prototipo funcional del sistema de inventarios del ERP de CBN (canal de preventa): tres almacenes (La Paz, Cochabamba y Santa Cruz), inventario perpetuo valorado con FIFO por capas, reposición por traslado entre plantas y 16 alertas tipo semáforo. Todo se guarda en PostgreSQL y se calcula en el backend; los datos de muestra corresponden al **30/06/2027**.

- Especificación: [docs/ESPECIFICACION.md](docs/ESPECIFICACION.md)
- Guion de la demo: [docs/GUION_DEMO.md](docs/GUION_DEMO.md)
- Trazabilidad de requisitos: [docs/TRAZABILIDAD.md](docs/TRAZABILIDAD.md)

## Requisitos

| Programa | Para qué | Cómo comprobarlo |
|----------|----------|------------------|
| **Node.js 22 o superior** (con npm) | backend, frontend y scripts | `node -v` en la Terminal |
| **Docker Desktop** (Apple Silicon si tu Mac es M1 o posterior) | base de datos PostgreSQL 16 | abre la app; la ballena aparece en la barra de menú |
| **Git** | descargar el proyecto | `git --version` |

## Iniciar la demo (un solo comando)

1. Abre **Docker Desktop** y espera a que la ballena deje de moverse.
2. Abre la **Terminal** (Cmd + Espacio, escribe «Terminal») y entra en la carpeta del proyecto:
   ```bash
   cd "ruta/a/Inventory System"
   ```
3. Ejecuta:
   ```bash
   npm run demo:iniciar
   ```
   La primera vez tarda 1 o 2 minutos. El comando:
   - crea `.env`;
   - instala las dependencias si faltan;
   - levanta PostgreSQL y aplica las migraciones;
   - siembra el escenario del 30/06/2027;
   - compila;
   - arranca el backend y el frontend en segundo plano;
   - abre <http://localhost:5173>.

   Termina con «✅ Demo lista» e «Integridad OK».
4. Para apagar todo (backend, frontend y PostgreSQL; los datos se conservan):
   ```bash
   npm run demo:detener
   ```

Los registros de los procesos quedan en `.demo/backend.log` y `.demo/frontend.log`.

## Usuarios

No hay contraseñas: el usuario se elige en la esquina superior derecha. El backend valida igual los permisos de cada rol ([docs/PERMISOS.md](docs/PERMISOS.md)).

| Usuario | Rol | Qué hace en la demo |
|---------|-----|---------------------|
| `PV-014` | R01 Preventista | Ve disponible o agotado y crea pedidos; no ve costos ni alertas |
| `SUP-01` | R02 Supervisor de ventas | Propone promociones; ve análisis y fiestas |
| `AST-01` | R03 Asistente de pedidos | Consulta stock y pedidos |
| `ALM-LP` · `ALM-CB` · `ALM-SC` | R06 Almacén | Opera solo su almacén: recepción, despacho, conteo ciego, cuarentena y envases |
| `LOG-01` | R07 Coordinador de logística | Aprueba ajustes y traslados, atiende alertas, edita parámetros y umbrales (usuario por defecto) |
| `GER-01` | R08 Gerencia | Consulta todo |
| `TI-01` | R09 Administrador de sistemas | Administración: integridad, restablecer datos y fallas de integración |

## Mapa de pantallas

| Pantalla | Ruta | Qué muestra |
|----------|------|-------------|
| Tablero | `/tablero` | KPIs, semáforo artículo × almacén, alertas que requieren acción, gráficos de stock y ventas |
| Alertas | `/alertas` | Centro de alertas AL01–AL16: filtros, detalle con medidor, atención y umbrales |
| Artículos | `/articulos` y `/articulos/ART-10021` | Listado y ficha: posición, parámetros con fórmulas, capas FIFO y kardex valorado |
| Operaciones | `/operaciones` | Recepción, pedidos, traslados, conteo ciego, ajustes, cuarentena, envases y promociones, cada una con su efecto en capas, costos y alertas |
| Aprobaciones | `/aprobaciones` | Bandeja de R07: ajustes, diferencias de recepción, promociones y cuarentena |
| Análisis | `/analisis` | Pareto ABC, Pareto de ajustes, rotación y exactitud de conteos |
| Fiestas | `/fiestas` | Calendario 2027, cronograma de preparación, ROP de fiesta y traslados extraordinarios |
| Costos | `/costos` | Adquisición, conservación, pedido y agotamiento por artículo y mes |
| Administración | `/administracion` | Reloj y escenarios, integridad, restablecer datos, fallas simuladas y bitácora |

En la barra superior están:
- el filtro de almacén;
- la fecha simulada (solo R07 y R09 la cambian);
- la campana de alertas rojas;
- el **Modo presentación**, que agranda la letra, sube el contraste y oculta lo secundario;
- el tema claro u oscuro.

Capturas: [docs/capturas](docs/capturas) y una por escena del guion en [docs/capturas/recorrido](docs/capturas/recorrido).

## Comandos

Todos se ejecutan desde la carpeta raíz.

| Comando | Qué hace |
|---------|----------|
| `npm run demo:iniciar` / `demo:detener` | Levanta / apaga toda la demo |
| `npm run verificar` | Lint, tests (unitarios, integración y componentes), compilación, humo con accesibilidad y recorrido completo |
| `npm test` | Tests del backend (unitarios e integración en la base `inventario_test`) y del frontend |
| `npm run test:humo` | Playwright: pantallas principales y axe-core en claro y oscuro |
| `npm run test:recorrido` | Playwright: las 10 escenas del guion con los números exactos (≈ 30 s) |
| `npm run capturas` | Regenera `docs/capturas` y `docs/capturas/recorrido` |
| `npm run db:up` / `db:down` | Inicia / detiene PostgreSQL |
| `npm run db:seed` | Vuelve al escenario del 30/06/2027 (determinista) |
| `npm run db:verificar` | Comprueba la integridad de capas y movimientos |
| `npm run db:migrate` | Crea una migración nueva en desarrollo |
| `npm run backend:dev` / `frontend:dev` | Modo desarrollo con recarga automática (backend :3000, frontend :5173) |
| `npm run demo:api` / `demo:alertas` | Ensayos de la demo por HTTP (con el backend en marcha) |

API con ejemplos (Swagger): <http://localhost:3000/api/docs>. Cada petición lleva el encabezado `X-Usuario`:

```bash
curl -H 'X-Usuario: LOG-01' 'http://localhost:3000/api/alertas/resumen'
```

### Instalación manual (modo desarrollo)

```bash
cp .env.example .env
npm run db:up
npm run install:all
(cd backend && npx prisma migrate deploy)
npm run db:seed
npm run backend:dev     # en una terminal
npm run frontend:dev    # en otra terminal
```

## Solución de problemas

| Síntoma | Solución |
|---------|----------|
| «Docker está instalado pero no está abierto» | Abre Docker Desktop, espera la ballena quieta y repite `npm run demo:iniciar`. |
| «Ya hay algo respondiendo en http://localhost:3000» (o 5173) | Hay un `backend:dev` o `frontend:dev` abierto: presiona Ctrl + C en esa terminal, o ejecuta `npm run demo:detener`. |
| «El backend de una demo anterior sigue encendido» | `npm run demo:detener` y luego `npm run demo:iniciar`. |
| Puerto 5432 ocupado | Otro PostgreSQL local está usando el puerto: detenlo, o cambia `POSTGRES_PORT` y el puerto de `DATABASE_URL` en `.env`. |
| Los números no coinciden con el guion | Administración → «Restablecer datos» (TI-01 o LOG-01), o `npm run db:seed`. |
| «Cannot find module … generated/prisma» | `npm --prefix backend install` (genera el cliente de Prisma). |
| La página dice «Restableciendo los datos…» | Es normal durante un restablecimiento: reintenta sola en unos segundos. |
| Algo más | Revisa `.demo/backend.log` y `.demo/frontend.log`. |

Para borrar también los datos de PostgreSQL: `docker compose down -v` (después, `npm run demo:iniciar` los vuelve a crear).

## Estructura

```
backend/              NestJS + Prisma (API en /api)
  prisma/             esquema, migraciones, seed y verificación de integridad
  src/inventario/     motor FIFO, fórmulas, operaciones e integridad
  src/alertas/        evaluadores AL01–AL16 y ciclo de vida
  src/analisis/       tablero, costos, fiestas, ABC y rotación
  src/demo/           seed reutilizable y restablecimiento de la demo
  test/               tests de integración (base inventario_test)
frontend/             React + Vite + Tailwind
  src/paginas/        una carpeta por pantalla
  e2e/                Playwright: humo, accesibilidad, recorrido y capturas
scripts/demo.mjs      demo:iniciar y demo:detener
docs/                 especificación, modelo de datos, permisos, alertas, frontend, guion y trazabilidad
```

Más detalle: [docs/MODELO_DATOS.md](docs/MODELO_DATOS.md), [docs/ALERTAS.md](docs/ALERTAS.md) y [docs/FRONTEND.md](docs/FRONTEND.md).
