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
docker-compose.yml       PostgreSQL 16
.env.example             credenciales de ejemplo (copiar a .env, no se sube)
package.json             scripts de la raíz
backend/
  prisma/                schema.prisma y migraciones (prisma.config.ts lee ../.env)
  src/
    prisma/              PrismaService global
    salud/               GET /api/salud
    inventario/ alertas/ articulos/ almacenes/ usuarios/ simulacion/   módulos de dominio
    generated/prisma/    cliente generado (no se sube)
frontend/
  src/                   App.tsx (pantalla de salud), main.tsx (router + React Query)
```

## Comandos principales (desde la raíz)
- `npm run db:up` / `npm run db:down` — iniciar / detener PostgreSQL.
- `npm run install:all` — instalar dependencias de backend y frontend.
- `npm run db:migrate` — aplicar migraciones de Prisma.
- `npm run backend:dev` — backend en http://localhost:3000 (prefijo `/api`).
- `npm run frontend:dev` — frontend en http://localhost:5173.
- `npm --prefix frontend run build` / `npm --prefix backend run build` — compilar.

## Reglas de trabajo
- Idioma: español en código de dominio, mensajes, commits y documentación.
- Git: cambiar de rama siempre con `git checkout` (nunca `git switch`); trabajar en ramas `feature/...` y hacer merge a `main`.
- Commits pequeños, formato `tipo: descripción` (feat, fix, docs, chore).
- No modificar `docs/ESPECIFICACION.md` sin avisar antes al usuario.
- Todos los cálculos (SS, ROP, Q, Máx, FIFO, ABC, alertas, costos) se hacen en el backend; el frontend solo muestra.
- Los movimientos de inventario nunca se borran ni se editan (las correcciones son movimientos nuevos o ajustes).

Ver docs/ESPECIFICACION.md para el detalle completo.
