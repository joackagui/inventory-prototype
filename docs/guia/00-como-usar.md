# 00 · Cómo usar esta guía

**Qué vas a aprender**
- En qué orden leer la guía y cuánto tarda cada parte.
- Cómo encender, apagar y «resetear» el sistema.
- Qué hacer si algo no arranca.

## Orden recomendado

| Paso | Capítulos | Tiempo | Resultado |
|------|-----------|--------|-----------|
| 1. Entender el negocio | [01](01-ideas-clave.md) | 30 min | Sabes qué problema resuelve el sistema |
| 2. Usarlo | [02](02-recorrido-practico.md) | 30 min (+ práctica) | Viste cada número con tus ojos |
| 3. Entender el código | [03](03-arquitectura.md) → [07](07-datos-permisos.md) | ≈ 2 h | Puedes explicar cómo funciona por dentro |
| 4. Tocarlo | [08](08-retos.md) | 30 min por reto | Aprendes rompiendo (sin miedo) |
| 5. Defenderlo | [09](09-defensa.md) | 30 min | Respuestas listas para el profesor |

Consejo: ten la aplicación abierta mientras lees. Casi todo lo que la guía dice se puede ver en la pantalla.

## Encender el sistema

1. Abre **Docker Desktop** (Cmd + Espacio, escribe «Docker»). Espera a que la ballena de la barra de menú deje de moverse. Docker es el programa que ejecuta la base de datos PostgreSQL dentro de un «contenedor» (una mini computadora aislada).
2. En iTerm2, entra en la carpeta del proyecto:
   ```bash
   cd ~/"UPB/8th semester/Management Information Systems/CBN/2nd evaluation/Inventory System"
   ```
   `cd` cambia de carpeta. `~` es tu carpeta personal. Las comillas son necesarias porque la ruta tiene espacios, y `~` va fuera de ellas porque entre comillas Zsh no lo reemplaza.
3. Ejecuta:
   ```bash
   npm run demo:iniciar
   ```
   `npm run` ejecuta un «script» definido en `package.json`. Este en concreto (`scripts/demo.mjs`) hace todo en orden:
   - comprueba Docker;
   - crea `.env` si falta;
   - instala las dependencias;
   - levanta PostgreSQL;
   - aplica las migraciones (crea las tablas);
   - siembra los datos del 30/06/2027;
   - compila;
   - arranca el backend (puerto 3000) y el frontend (puerto 5173);
   - abre el navegador.

   Termina con «✅ Demo lista» e «Integridad OK (268 capas)».

## Apagar el sistema

```bash
npm run demo:detener
```

Detiene el frontend, el backend y PostgreSQL. **Los datos se conservan**: la próxima vez que inicies, vuelves a empezar desde el escenario sembrado.

## Volver al estado inicial («resetear»)

Las prácticas cambian los datos (venden, trasladan, ajustan). Para volver al 30/06/2027 con 19 alertas tienes tres caminos:

| Camino | Cómo | Cuándo |
|--------|------|--------|
| Desde la app | Usuario **TI-01** o **LOG-01** → *Administración* → «Restablecer datos» → escribir `RESTABLECER` | Durante una práctica o la demo (tarda menos de 1 s) |
| Desde la terminal | `npm run db:seed` | Cuando el backend está apagado, o en modo desarrollo |
| Todo de cero | `npm run demo:detener` y luego `npm run demo:iniciar` (también siembra) | Si algo quedó raro |

`npm run db:seed` vacía las tablas y vuelve a cargar exactamente los mismos datos: el seed es **determinista** (siempre produce lo mismo).

## Modo desarrollo (para los retos del capítulo 08)

En los retos vas a cambiar código, y te conviene que se recargue solo:

```bash
npm run demo:detener      # libera los puertos 3000 y 5173
npm run db:up             # solo PostgreSQL (docker compose up -d)
npm run backend:dev       # backend con recarga automática (déjalo abierto)
npm run frontend:dev      # en otra pestaña de iTerm2 (⌘T): frontend con recarga
```

## Si algo falla

| Síntoma | Qué hacer |
|---------|-----------|
| «Docker está instalado pero no está abierto» | Abre Docker Desktop y repite |
| «Ya hay algo respondiendo en http://localhost:3000» | Tienes un `backend:dev` abierto: Ctrl + C en esa pestaña |
| Los números no coinciden con la guía | Restablece los datos (tabla de arriba) |
| Otra cosa | Mira `.demo/backend.log` con `tail -50 .demo/backend.log` (muestra las últimas 50 líneas) |

## Ideas para recordar
- `npm run demo:iniciar` / `npm run demo:detener` encienden y apagan todo.
- «Restablecer datos» (en Administración) devuelve el escenario del 30/06/2027 en menos de un segundo.
- Las prácticas cambian los datos: restablece antes de empezar cada una si quieres ver los mismos números que la guía.

---
[Índice](README.md) · Siguiente: [01 · El problema y las ideas clave →](01-ideas-clave.md)
