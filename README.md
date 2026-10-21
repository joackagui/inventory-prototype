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

Abre <http://localhost:5173>: debe decir **Backend 🟢 ok** y **Base de datos 🟢 conectada**.

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
| `npm test`             | Tests unitarios y de integración (base `inventario_test`) |
| `npm run demo:api`     | Ensayo de la demo por HTTP (con el backend en marcha) |
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

## Tests

`npm test` corre los tests unitarios de las fórmulas y los de integración. Los de integración usan una segunda base, `inventario_test`, en el mismo contenedor de PostgreSQL. Se crea y migra sola, y se vuelve a sembrar antes de cada archivo. No toca los datos de la demo.

## Problemas comunes

- **"Base de datos: sin conexión"**: Docker Desktop no está abierto o falta `npm run db:up`.
- **Puerto 5432 ocupado**: tienes otro PostgreSQL local; detenlo o cambia `POSTGRES_PORT` y el puerto en `DATABASE_URL` dentro de `.env`.
- **Error "Cannot find module ... generated/prisma"**: ejecuta `npm --prefix backend install` (genera el cliente de Prisma).
