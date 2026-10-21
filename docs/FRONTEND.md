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
  paginas/
    tablero/         Tablero: KPIs, matriz semáforo, gráficos, alertas que requieren acción, vista del preventista
    alertas/         Centro de alertas: píldoras, filtros (familias.ts), FilaAlerta, PanelAlerta (medidor, historial,
                     atender), Umbrales (edición validada + bitácora)
    articulos/       Articulos (tabla) y Ficha: SeccionPosicion, SeccionParametros (fórmulas + diálogo con vista
                     previa), SeccionCapas (cola FIFO), SeccionKardex (serie + kardex + CSV)
    operaciones/     Operaciones: menú de tarjetas según el rol (?tipo=recepcion|pedidos|traslados|conteo|ajustes|cuarentena|
                     envases|promociones, más &articulo=&almacen=&id=&cliente= para llegar prellenado); comun.tsx (almacén fijo
                     para R06, selectores), LineasRecepcion (recepción de traslado con diferencias)
    aprobaciones/    Aprobaciones: bandeja (ajustes, diferencias de recepción, promociones propuestas, capas en cuarentena),
                     AccionesResolucion (aprobar / rechazar con comentario obligatorio; «quien registra no aprueba»)
    analisis/        ABC y Pareto (con recálculo y vista previa de cambios), Pareto de ajustes, rotación, conteos y exactitud
    fiestas/         línea de tiempo anual, detalle con cronograma de hitos, tabla y fórmulas de fiesta, acciones
                     (traslados extraordinarios ?extraordinario=ART:cant,... y promoción festiva prellenada)
    costos/          tarjetas, barras apiladas, desglose con fórmulas y diálogo de parámetros con vista previa
    administracion/  reloj y escenarios, restablecer datos, fallas simuladas, integridad, usuarios, bitácora, configuración
    Proximamente     recibe y muestra los parámetros de la URL (?accion=…&articulo=…) hasta que la pantalla exista
    SinAcceso
  utils/formato.ts   números 1,260 · fechas dd/mm/aaaa · USD 1,234.56
e2e/
  comun.ts           sembrar(), abrir(página, ruta, usuario, tema), irA(), vigilancia de errores de consola
  humo.spec.ts       tablero, fecha simulada, cambio a PV-014
  accesibilidad.spec.ts  axe-core (WCAG 2.1 AA) en 9 pantallas, claro y oscuro: cero violaciones serias o críticas
  recorrido.spec.ts  @recorrido: las 10 escenas de docs/GUION_DEMO.md con números exactos (npm run test:recorrido)
  alertas-articulos.spec.ts  Centro de alertas y ficha del artículo
  capturas.spec.ts   @capturas: solo con `npm run capturas`
```

## Tokens de diseño
Están definidos como variables CSS en `:root` (tema claro) y `[data-theme='oscuro']`, y se exponen a Tailwind con `@theme inline`. Por ejemplo, `bg-superficie`, `text-suave` o `bg-rojo-fondo`.

| Token | Uso |
|---|---|
| `fondo`, `superficie`, `superficie-2`, `borde` | Fondo gris azulado, tarjetas blancas, zonas internas y bordes finos |
| `texto`, `suave` | Texto principal y secundario |
| `marca`, `marca-2`, `marca-texto` | Azul marino de marca: barra lateral, botones primarios, selector activo |
| `acento`, `acento-suave` | Enlaces, fecha simulada, barras de ventas |
| `sobre-color` | Texto sobre un fondo de color sólido (`bg-acento`, `bg-rojo`): blanco en claro, oscuro en oscuro; nunca `text-white` |
| `verde`/`amarillo`/`rojo`/`azul` (+ `-fondo`) | Semáforo; en gráficos se usan como `var(--rojo)`, etc. |
| `shadow-tarjeta` | Sombra suave de las tarjetas |

- **Semáforo accesible** (`componentes/Semaforo.tsx`): ícono + texto (Normal, Atención, Crítico, Informativo), nunca solo color. En modo compacto el texto queda en `sr-only` y en el `title`.
- **Modo presentación** (botón de la barra superior, `cbn.presentacion` en localStorage): `data-presentacion` en `<html>` sube la letra base a 113%, oscurece `texto-suave` y `borde` (aclara en oscuro) y oculta todo lo que tenga la clase `secundario` (subtítulos descriptivos, pie de la barra lateral).
- **Contraste:** los tokens cumplen WCAG AA (4.5:1) en ambos temas; lo comprueba `accesibilidad.spec.ts`.
- **Tipografía:** Inter, con cifras tabulares en la clase `.num` (KPIs y tablas).
- **Animaciones:** `.entrar` (entrada de tarjetas; se repite al cambiar de almacén porque cambia la `key`) y `.pulso-rojo` (alertas rojas sin atender). Con `prefers-reduced-motion` se apagan.
- **Diseño adaptable:**
  - la barra lateral muestra solo íconos por debajo de 1536 px y etiquetas por encima;
  - los KPI van en 3 columnas por debajo de 1536 px y en 5 por encima;
  - la matriz y las alertas se ponen lado a lado desde 1536 px;
  - probado a 1366×768 y 1920×1080.

## Convenciones
- **Almacenes:** siempre de `useAlmacenes()` (GET /api/almacenes, solo plantas: código, nombre corto y largo, sigla) y `useNombreAlmacen()`; nunca códigos fijos.
- **Datos:** siempre con un hook de `api/consultas.ts`. La `queryKey` empieza por el recurso y lleva el usuario (`['tablero', usuario, almacen]`), así al cambiar de usuario todo se vuelve a pedir con sus permisos.
- **Mutaciones:** `useMutation` con `api(...)`. El `MutationCache` muestra el error y, si sale bien, invalida todas las consultas (cualquier operación cambia stock y alertas). El cambio de fecha muestra cuántas alertas cambiaron (dato que devuelve el backend).
- **Carga diferida:** cada pantalla se importa con `React.lazy` en `App.tsx` (recharts va en su propio paquete). Paquete inicial: 406 kB (antes 1,069 kB).
- **Restablecimiento:** si la API responde 503 `DEMO_RESTABLECIENDO`, `api()` muestra «Restableciendo los datos…» y reintenta cada 1.5 s, en cualquier pestaña.
- **Errores:** los muestra `QueryCache.onError` con un aviso en español; dentro de la pantalla, `EstadoError` con «Reintentar».
- **Estados:** `Esqueleto` mientras carga, `EstadoVacio` sin datos, `EstadoError` si falla.
- **Formato:** solo con `utils/formato.ts`, nunca con `toLocaleString` suelto.
- **Permisos:** el menú y `RequiereRol` usan `sesion/permisos.ts`; el backend valida igual. R01 ve la vista simplificada del tablero.
- **Estilo del código:** sin punto y coma, comillas simples (como la plantilla de Vite), y textos de la interfaz en español.

## Cómo agregar una pantalla
1. Crea `src/paginas/<seccion>/<Seccion>.tsx` usando `Tarjeta`, `Semaforo`, `Kpi` y los estados.
2. Agrega sus hooks en `api/consultas.ts` y sus tipos en `api/tipos.ts`.
3. La ruta muestra `<Proximamente>` hasta que la agregues en `App.tsx`. La sección ya existe en `sesion/permisos.ts`; ajusta sus `roles` si hace falta y actualiza docs/PERMISOS.md.
4. Importa la pantalla con `lazy()` en el mapa `PANTALLAS` de `App.tsx`.
5. Agrega una prueba de componente (`*.test.tsx`) si tiene lógica de presentación, un paso en `e2e/humo.spec.ts` si es clave para la demo, y la ruta en `e2e/accesibilidad.spec.ts`.

## Componentes visuales clave
- **`Medidor`:** valor medido frente a los umbrales amarillo y rojo de una alerta, con tramos de color y una marca. Usa la misma regla que el backend (≤ cuando menor es peor, > en el resto). El dato `medicion` lo calcula el backend.
- **`BarraPosicion`:** bullet chart con disponible, tránsito (rayado) y reservado apilados, y marcas de SS (rojo), ROP (amarillo) y Máx (azul).
- **`BarraFuncion`:** el stock por función (seguridad, ciclo, tránsito, estacional) como barra segmentada.
- **`VidaRestante`:** barra de vida de una capa (verde > 30 días, amarillo 15–30, rojo < 15) con `role="meter"`.
- **`ColaFifo`:** esquema Entrada → capas (de la más nueva a la más antigua) → Salida. Marca la «Próxima en salir» con un anillo y las no despachables con borde punteado.

## Operaciones: cómo se muestra el efecto
- **`ResultadoOperacion`:** se muestra después de cada operación confirmada y es lo que hace visible el efecto en la demo. Contiene:
  - lo registrado;
  - las capas FIFO que salieron (lote, cantidad × costo, vencimiento) en una mini cola hacia la «salida», y el costo total;
  - el cambio de stock;
  - el bloque de efecto en alertas: ＋ creadas, − resueltas y ↻ cambios de color, con enlace al artículo.

  Los datos vienen de `capasConsumidas`, `costoTotal` y `efectoAlertas`, que devuelve el backend.
- **Errores dentro del formulario:** las mutaciones o consultas con `meta: { silencioso: true }` no muestran el aviso global, porque el error se ve en el propio formulario (el faltante de un pedido, devolver de más, la vista previa de recepción o del impacto de un ajuste).
- **Avisos previos al confirmar:** los calcula siempre el backend (`/operaciones/recepcion/previa` para el vencimiento y AL13; `/ajustes/impacto` para el valor en USD). El navegador no calcula costos.
- **Sin doble envío:** `BotonPrimario` se desactiva mientras la operación está en curso.

## Componentes de análisis
- **`GraficoPareto`:** barras ordenadas, línea de % acumulado y marcas en 80% y 95%. Las barras se colorean por clase (`COLOR_CLASE`).
- **`LineaTiempoFiestas`:** fiestas posicionadas en porcentaje del rango, ventana de preparación sombreada y marcador de la fecha simulada.
- **`Cronograma`:** hitos con estado (hecho, en curso, próximo), fechas, responsables y acción.
- **`DialogoRestablecer`:** solo se confirma escribiendo RESTABLECER; muestra el progreso mientras corre.

## Pruebas
- `npm --prefix frontend test`: Vitest + Testing Library con happy-dom (formateadores, semáforo, control de fecha).
- `npm --prefix frontend test`: Vitest también cubre los filtros de alertas, el medidor, la barra de posición, la cola FIFO y la vida restante.
- `npm run test:humo`: Playwright con el Chromium ya instalado en la caché de Playwright (no descarga navegadores). `operaciones.spec.ts` recorre la historia completa (casos a–h). Los 400, 403 y 409 esperados (que el navegador registra como errores de red) no cuentan como errores de consola.
  - Levanta backend y frontend si no están corriendo; cada archivo vuelve a sembrar la base.
  - Comprueba el tablero, el Centro de alertas, la ficha, los permisos y que no haya errores en la consola.
  - **No** toca `docs/capturas/`.
- `npm run test:recorrido`: el guion completo en una prueba (≈ 30 s); siembra al inicio y termina con «Restablecer datos». Falla ante errores de consola o respuestas 5xx.
- `npm run capturas`: regenera las capturas de `docs/capturas/` (tablero, alertas con el panel abierto y la ficha del ART-10021 por secciones, en claro y oscuro) y una por escena en `docs/capturas/recorrido/` (`CAPTURAS=1`). Ejecútalo solo cuando quieras actualizar las imágenes versionadas.
- `npm run verificar` (raíz): lint, todos los tests, compilación, humo y recorrido.
