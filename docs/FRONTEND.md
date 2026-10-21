# Frontend — Inventario CBN

React 19 + Vite + TypeScript + Tailwind CSS 4 + React Query + react-router + recharts.

Dependencias extra, todas ligeras:
- `lucide-react` (íconos) y `sonner` (avisos);
- `@fontsource/inter` (fuente local, solo el subconjunto latino) y `clsx`;
- dos primitivas sueltas de Radix: `react-dialog` (panel lateral) y `react-dropdown-menu` (selector de usuario).

**El frontend solo muestra datos: todos los cálculos están en el backend.**

## Estructura
```
src/
  index.css          tokens de diseño (claro/oscuro) y animaciones
  main.tsx           React Query (errores con aviso, invalidación tras mutaciones), sesión, router, avisos
  App.tsx            rutas: cada sección de sesion/permisos.ts; las que no existen muestran «Próximamente»
  api/
    cliente.ts       fetch con X-Usuario; errores { codigo, mensaje, detalles } → ErrorApi
    tipos.ts         tipos de las respuestas usadas
    consultas.ts     hooks de React Query (las claves llevan el usuario)
  sesion/
    Sesion.tsx       usuario, almacén y tema (localStorage con try/catch)
    permisos.ts      secciones del menú y roles que las ven (espejo de docs/PERMISOS.md)
  diseno/Layout.tsx  barra lateral, barra superior y RequiereRol
  componentes/       Semaforo, Tarjeta/Esqueleto, Estados (vacío y error), Kpi, ControlFecha + RelojSimulado,
                     SelectorAlmacen, SelectorUsuario, Campana, TemaToggle, PanelLateral
  paginas/           Tablero (tablero/*), Proximamente, SinAcceso
  utils/formato.ts   números 1,260 · fechas dd/mm/aaaa · USD 1,234.56
e2e/humo.spec.ts     prueba de humo con Playwright (+ capturas en docs/capturas)
```

## Tokens de diseño
Están definidos como variables CSS en `:root` (tema claro) y `[data-theme='oscuro']`, y se exponen a Tailwind con `@theme inline`. Por ejemplo, `bg-superficie`, `text-suave` o `bg-rojo-fondo`.

| Token | Uso |
|---|---|
| `fondo`, `superficie`, `superficie-2`, `borde` | Fondo gris azulado, tarjetas blancas, zonas internas y bordes finos |
| `texto`, `suave` | Texto principal y secundario |
| `marca`, `marca-2`, `marca-texto` | Azul marino de marca: barra lateral, botones primarios, selector activo |
| `acento`, `acento-suave` | Enlaces, fecha simulada, barras de ventas |
| `verde`/`amarillo`/`rojo`/`azul` (+ `-fondo`) | Semáforo; en gráficos se usan como `var(--rojo)`, etc. |
| `shadow-tarjeta` | Sombra suave de las tarjetas |

- **Semáforo accesible** (`componentes/Semaforo.tsx`): ícono + texto (Normal, Atención, Crítico, Informativo), nunca solo color. En modo compacto el texto queda en `sr-only` y en el `title`.
- **Tipografía:** Inter, con cifras tabulares en la clase `.num` (KPIs y tablas).
- **Animaciones:** `.entrar` (entrada de tarjetas; se repite al cambiar de almacén porque cambia la `key`) y `.pulso-rojo` (alertas rojas sin atender). Con `prefers-reduced-motion` se apagan.
- **Diseño adaptable:**
  - la barra lateral muestra solo íconos por debajo de 1536 px y etiquetas por encima;
  - los KPI van en 3 columnas por debajo de 1536 px y en 5 por encima;
  - la matriz y las alertas se ponen lado a lado desde 1536 px;
  - probado a 1366×768 y 1920×1080.

## Convenciones
- **Datos:** siempre con un hook de `api/consultas.ts`. La `queryKey` empieza por el recurso y lleva el usuario (`['tablero', usuario, almacen]`), así al cambiar de usuario todo se vuelve a pedir con sus permisos.
- **Mutaciones:** `useMutation` con `api(...)`. El `MutationCache` muestra el error y, si sale bien, invalida todas las consultas (cualquier operación cambia stock y alertas). El cambio de fecha muestra cuántas alertas cambiaron (dato que devuelve el backend).
- **Errores:** los muestra `QueryCache.onError` con un aviso en español; dentro de la pantalla, `EstadoError` con «Reintentar».
- **Estados:** `Esqueleto` mientras carga, `EstadoVacio` sin datos, `EstadoError` si falla.
- **Formato:** solo con `utils/formato.ts`, nunca con `toLocaleString` suelto.
- **Permisos:** el menú y `RequiereRol` usan `sesion/permisos.ts`; el backend valida igual. R01 ve la vista simplificada del tablero.
- **Estilo del código:** sin punto y coma, comillas simples (como la plantilla de Vite), y textos de la interfaz en español.

## Cómo agregar una pantalla
1. Crea `src/paginas/<seccion>/<Seccion>.tsx` usando `Tarjeta`, `Semaforo`, `Kpi` y los estados.
2. Agrega sus hooks en `api/consultas.ts` y sus tipos en `api/tipos.ts`.
3. En `App.tsx`, renderiza tu componente en lugar de `<Proximamente>` para esa ruta. La sección ya existe en `sesion/permisos.ts`; ajusta sus `roles` si hace falta y actualiza docs/PERMISOS.md.
4. Agrega una prueba de componente (`*.test.tsx`) si tiene lógica de presentación, y un paso en `e2e/humo.spec.ts` si es clave para la demo.

## Pruebas
- `npm --prefix frontend test`: Vitest + Testing Library con happy-dom (formateadores, semáforo, control de fecha).
- `npm --prefix frontend run test:humo`: Playwright con el Chromium ya instalado en la caché de Playwright (no descarga navegadores).
  - Levanta backend y frontend si no están corriendo y vuelve a sembrar la base.
  - Comprueba: las 19 alertas con ALM-LP y LOG-01, el cambio de fecha +5 días, la vista de PV-014 y que no haya errores en la consola.
  - Guarda las capturas en `docs/capturas/`.
