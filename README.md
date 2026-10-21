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

# 4. Crear las tablas en la base de datos (migraciones de Prisma)
npm run db:migrate

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
| `npm run backend:dev`  | Backend NestJS con recarga automática            |
| `npm run frontend:dev` | Frontend Vite con recarga automática             |

Para borrar también los datos de la base: `docker compose down -v`.

## Problemas comunes

- **"Base de datos: sin conexión"**: Docker Desktop no está abierto o falta `npm run db:up`.
- **Puerto 5432 ocupado**: tienes otro PostgreSQL local; detenlo o cambia `POSTGRES_PORT` y el puerto en `DATABASE_URL` dentro de `.env`.
- **Error "Cannot find module ... generated/prisma"**: ejecuta `npm --prefix backend install` (genera el cliente de Prisma).
