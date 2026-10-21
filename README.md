# Inventario CBN — Prototipo

Prototipo del sistema de inventarios del ERP de CBN (FIFO, sistema perpetuo, 3 almacenes). La especificación completa está en [docs/ESPECIFICACION.md](docs/ESPECIFICACION.md).

## Requisitos

- **Node.js 22 o superior** (probado con Node 26) y npm — `node -v` para comprobarlo.
- **Docker Desktop** (versión para Apple Silicon si tienes Mac M1–M5) abierto y corriendo.
- Git.

## Levantar todo desde cero

Todos los comandos se ejecutan desde la carpeta raíz del proyecto.

```bash
# 1. Variables de entorno (usuario, clave y base de PostgreSQL)
cp .env.example .env

# 2. Base de datos PostgreSQL 16 en Docker (queda corriendo en segundo plano)
npm run db:up

# 3. Instalar dependencias del backend y del frontend
npm run install:all

# 4. Crear las tablas y cargar el escenario de demo (30/06/2027)
npm run db:migrate
npm run db:seed

# 5. Iniciar el backend (déjalo abierto en una terminal)
npm run backend:dev

# 6. Iniciar el frontend (en otra terminal)
npm run frontend:dev
```

Abre <http://localhost:5173>: se abre el **Tablero** como `LOG-01` (Coordinador de logística).

- **Barra superior:** almacén (Todos, LP, CB, SC), fecha simulada (−1 / +1 / +7 / +30 días, un día exacto o volver al 30/06/2027), campana de alertas rojas sin atender, tema claro u oscuro y selector de usuario.
- **Al cambiar de usuario** cambian el menú, los permisos y los datos. Por ejemplo, `PV-014` (preventista) solo ve «Disponible / Agotado».

La API con ejemplos está en <http://localhost:3000/api/docs>.

Pantallas disponibles:
- **Operaciones** (`/operaciones`): recepción, pedidos (reserva y despacho FIFO), traslados (propuestas y seguimiento), conteo ciego, ajustes, cuarentena, envases y promociones. Cada operación muestra las capas FIFO consumidas, su costo y qué alertas se crearon o resolvieron.
- **Aprobaciones** (`/aprobaciones`, R07): ajustes y mermas, diferencias de recepción, promociones propuestas y capas en cuarentena.
- **Tablero:** KPIs y semáforo por artículo y almacén.
- **Centro de alertas** (`/alertas`): filtros, detalle con medidor, atención y umbrales.
- **Artículos** (`/articulos`) y **ficha del artículo** (`/articulos/ART-10021`): posición de stock, parámetros con fórmulas y edición con vista previa, capas FIFO y kardex.

Capturas en [docs/capturas](docs/capturas). Cómo está hecho el frontend: [docs/FRONTEND.md](docs/FRONTEND.md).

## Puertos

| Servicio   | URL                                  |
|------------|--------------------------------------|
| Frontend   | http://localhost:5173                |
| Backend    | http://localhost:3000/api            |
| Salud      | http://localhost:3000/api/salud      |
| PostgreSQL | localhost:5432                       |

## Comandos útiles

| Comando                | Qué hace                                         |
|------------------------|--------------------------------------------------|
| `npm run db:up`        | Inicia PostgreSQL en Docker                      |
| `npm run db:down`      | Detiene PostgreSQL (los datos se conservan)      |
| `npm run db:migrate`   | Aplica las migraciones de Prisma                 |
| `npm run db:seed`      | Vacía las tablas y carga el escenario de demo    |
| `npm run db:reset`     | Borra la base, migra, siembra y verifica         |
| `npm run db:verificar` | Comprueba la integridad (capas vs. movimientos)  |
| `npm test`             | Tests del backend (unitarios e integración, base `inventario_test`) y del frontend |
| `npm run test:humo`    | Prueba de humo del navegador con Playwright (no modifica las capturas) |
| `npm run capturas`     | Regenera las capturas de docs/capturas |
| `npm run demo:api`     | Ensayo de la demo por HTTP (con el backend en marcha) |
| `npm run demo:alertas` | Ensayo de la demo de alertas (con el backend en marcha) |
| `npm run backend:dev`  | Backend NestJS con recarga automática            |
| `npm run frontend:dev` | Frontend Vite con recarga automática             |

Para borrar también los datos de la base: `docker compose down -v`.

## Resetear los datos de la demo

Si durante una prueba se ensuciaron los datos, vuelve al escenario inicial del 30/06/2027 con:

```bash
npm run db:seed     # rápido: vacía las tablas y vuelve a sembrar
npm run db:reset    # completo: borra la base, aplica migraciones, siembra y verifica
```

El seed es determinista: siempre produce exactamente los mismos datos. El escenario está documentado en [docs/MODELO_DATOS.md](docs/MODELO_DATOS.md).

## API

La documentación interactiva (Swagger, con ejemplos) está en <http://localhost:3000/api/docs>.

Cada petición lleva el encabezado `X-Usuario` con el código del usuario. En Swagger se pone con el botón **Authorize**. Por ejemplo:

```bash
curl -H 'X-Usuario: LOG-01' 'http://localhost:3000/api/stock?almacenId=CD-LP-01'
curl -X POST -H 'X-Usuario: PV-014' -H 'Content-Type: application/json' \
  -d '{"cliente":"Cliente 001","almacen":"CD-LP-01","lineas":[{"articulo":"ART-10021","cantidad":100}]}' \
  http://localhost:3000/api/pedidos
```

Qué puede hacer cada rol: [docs/PERMISOS.md](docs/PERMISOS.md). Los errores siempre tienen la forma `{ codigo, mensaje, detalles }`.

## Ensayar la demo

Con el backend en marcha (`npm run backend:dev`), en otra terminal:

```bash
npm run demo:api
```

Vuelve a sembrar el escenario y recorre por la API pedido → despacho → traslado → recepción con diferencia → conteo → ajuste → aprobación → cuarentena. Muestra el resultado de cada paso y las alertas que deberían aparecer. Con `npm run demo:api -- --sin-sembrar` no vuelve a sembrar.

## Alertas

El backend evalúa 16 alertas tipo semáforo (AL01–AL16) con la fecha simulada:
- después de cada operación;
- al cambiar la fecha;
- al arrancar.

El estado base del 30/06/2027 tiene 19 alertas vigentes. Para verlas:

```bash
curl -H 'X-Usuario: LOG-01' 'http://localhost:3000/api/alertas/resumen'
curl -H 'X-Usuario: LOG-01' 'http://localhost:3000/api/semaforo?almacenId=CD-LP-01'
```

`npm run demo:alertas` recorre la historia completa:
1. estado base;
2. un despacho que dispara una alerta;
3. una recepción que la resuelve;
4. avanzar la fecha y ver los vencimientos;
5. escalamiento;
6. falla de integración y su reproceso.

Umbrales, roles y reglas: [docs/ALERTAS.md](docs/ALERTAS.md).

## Tests

`npm test` corre los tests unitarios de las fórmulas y los de integración. Los de integración usan una segunda base, `inventario_test`, en el mismo contenedor de PostgreSQL. Se crea y migra sola, y se vuelve a sembrar antes de cada archivo. No toca los datos de la demo.

## Problemas comunes

- **"Base de datos: sin conexión"**: Docker Desktop no está abierto o falta `npm run db:up`.
- **Puerto 5432 ocupado**: tienes otro PostgreSQL local; detenlo o cambia `POSTGRES_PORT` y el puerto en `DATABASE_URL` dentro de `.env`.
- **Error "Cannot find module ... generated/prisma"**: ejecuta `npm --prefix backend install` (genera el cliente de Prisma).
