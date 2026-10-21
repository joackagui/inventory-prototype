# Permisos por rol

Sin contraseñas: cada petición lleva el encabezado `X-Usuario` con el código del usuario (por ejemplo `ALM-LP`). El guard `UsuarioGuard` carga el usuario y su rol:
- **401 `NO_AUTENTICADO`:** falta el encabezado o el usuario no existe.
- **403 `SIN_PERMISO`:** el rol no tiene permiso para esa ruta.
- **403 `ALMACEN_AJENO`:** un R06 intenta operar un almacén que no es el suyo.
- **403 `AUTOAPROBACION`:** quien registró un ajuste o merma intenta aprobarlo o rechazarlo, aunque tenga el rol.

Usuarios: `PV-014` (R01) · `SUP-01` (R02) · `AST-01` (R03, sin almacén) · `ALM-LP`, `ALM-CB`, `ALM-SC` (R06, cada uno su almacén) · `LOG-01` (R07) · `GER-01` (R08) · `TI-01` (R09).

✔ = permitido · ✔¹ = solo en su almacén asignado · — = 403

| Método y ruta | R01 | R02 | R03 | R06 | R07 | R08 | R09 |
|---|---|---|---|---|---|---|---|
| `GET /api/salud`, `GET /api/usuarios`, `/api/docs` | público | público | público | público | público | público | público |
| `GET /api/yo`, `/api/almacenes`, `/api/fiestas`, `/api/simulacion/fecha`, `/api/pedidos` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/articulos/estado`, `GET /api/articulos/:codigo/resumen` | ✔ solo disponible/agotado | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/stock?almacenId=` | ✔ solo disponible/agotado, sin costos | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/articulos`, `/articulos/:codigo/capas`, `/articulos/:codigo/kardex`, `/articulos/:codigo/serie`, `/alertas/umbrales/detalle`, `/api/abc`, `/api/movimientos`, `/api/traslados`, `/api/traslados/propuesta`, `/api/ajustes`, `/api/conteos`, `/api/envases/saldos`, `/api/configuracion` | — | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `POST /api/pedidos` (reserva) | ✔ | — | — | — | ✔ (simula para la demo) | — | — |
| `GET /api/pedidos/:id`, `GET /api/clientes`, `GET /api/promociones` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/traslados/:id`, `/api/ajustes/:id`, `/api/ajustes/impacto`, `/api/envases/saldos/:id`, `/api/capas` | — | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/operaciones/recepcion/previa` | — | — | — | ✔¹ | ✔ | — | — |
| `POST /api/pedidos/:id/cancelar` | ✔ | — | — | ✔¹ | ✔ | — | — |
| `POST /api/pedidos/:id/despachar` | — | — | — | ✔¹ | ✔ | — | — |
| `POST /api/operaciones/recepcion` | — | — | — | ✔¹ | ✔ | — | — |
| `POST /api/conteos` | — | — | — | ✔¹ | ✔ | — | — |
| `POST /api/ajustes` (ajuste o merma, queda PENDIENTE) | — | — | — | ✔¹ | ✔ | — | — |
| `POST /api/ajustes/:id/aprobar` y `/rechazar` | — | — | — | — | ✔ (no el que lo registró) | — | — |
| `POST /api/cuarentena` | — | — | — | ✔¹ | ✔ | — | — |
| `POST /api/cuarentena/:capaId/liberar` | — | — | — | — | ✔ | — | — |
| `POST /api/envases/entrega` y `/devolucion` | — | — | — | ✔¹ | ✔ | — | — |
| `POST /api/traslados` (emitir) | — | — | — | — | ✔ | — | — |
| `POST /api/traslados/:id/despachar` | — | — | — | ✔ origen | ✔ | — | — |
| `POST /api/traslados/:id/recibir` | — | — | — | ✔ destino | ✔ | — | — |
| `POST /api/parametros/:articulo/:almacen/simular` (vista previa, no guarda) | — | — | — | — | ✔ | — | — |
| `PUT /api/parametros/:articulo/:almacen`, `POST /api/abc/recalcular` | — | — | — | — | ✔ | — | — |
| `PUT /api/configuracion/:clave` (umbrales, tasas, tolerancia) | — | — | — | — | ✔ | — | — |
| `PUT /api/simulacion/fecha`, `POST /api/simulacion/avanzar`, `POST /api/simulacion/restablecer` | — | — | — | — | ✔ | — | ✔ |
| `GET /api/analisis/rotacion`, `/api/analisis/conteos`, `/api/simulacion/escenarios` | — | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `POST /api/simulacion/escenario`, `POST /api/simulacion/restablecer-datos` (DEMO_MODE=true y `confirmacion: "RESTABLECER"`) | — | — | — | — | ✔ | — | ✔ |
| `POST /api/promociones/:id/rechazar` (comentario obligatorio) | — | — | — | — | ✔ | — | — |
| `GET /api/usuarios/permisos` | — | — | — | — | ✔ | ✔ | ✔ |
| `GET /api/integridad`, `GET /api/bitacora` | — | — | — | — | ✔ | — | ✔ |
| `GET /api/tablero/resumen`, `/api/costos`, `/api/fiestas/preparacion`, `/api/analisis/pareto-ajustes` | — | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/alertas`, `/api/alertas/resumen`, `/api/alertas/:id`, `/api/alertas/umbrales`, `/api/semaforo`, `/api/promociones` | — | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `POST /api/alertas/:id/atender` | — | ✔ si es responsable | ✔ solo AL11 | ✔ si es responsable y de su almacén | ✔ | — | ✔ si es responsable (AL16) |
| `POST /api/alertas/evaluar` | — | — | — | — | ✔ | — | ✔ |
| `PUT /api/alertas/umbrales/:clave` | — | — | — | — | ✔ | — | — |
| `POST /api/promociones` (propuesta) | — | ✔ | — | — | — | — | — |
| `POST /api/promociones/:id/aprobar` (con `referenciaCorreo`) y `/cerrar` | — | — | — | — | ✔ | — | — |
| `POST /api/simulacion/falla-integracion`, `GET /api/integracion/eventos` | — | — | — | — | ✔ | — | ✔ |
| `POST /api/integracion/eventos/:id/reprocesar` | — | — | — | — | — | — | ✔ |

Notas:
- **Respuestas de escritura:** todo `POST` y `PUT` responde con `efectoAlertas` (`creadas`, `resueltas` y `cambiadas`, con código, almacén, artículo, color antes y después, y mensaje). Las operaciones que consumen capas agregan `capasConsumidas` y `costoTotal`.
- **Rechazar un ajuste** exige `comentario`; al aprobar es opcional. Se guarda en `comentarioResolucion`.
- **Frontend, pantalla Operaciones:**
  - R01: Pedidos (crear y cancelar);
  - R02: Promociones (proponer) y Envases (consulta);
  - R03: Pedidos, Traslados y Promociones, en consulta;
  - R06: todo lo operativo de su almacén, que queda fijo;
  - R07: todo;
  - R08 y R09: solo consulta.
- **Frontend, pantalla Aprobaciones:** R07 decide y R08 la ve en solo lectura.
- **Frontend, pantallas nuevas:**
  - **Análisis:** R02, R07 y R08 (solo R07 recalcula el ABC).
  - **Fiestas:** R02 y R07 operan, R08 lee.
  - **Costos:** R07 y R08 (solo R07 cambia los parámetros).
  - **Administración:** R07 y R09 operan; R08 lee usuarios y configuración.
  - El backend de esas consultas sigue abierto a los roles de lectura; el frontend las acota según la especificación.
- **Restablecer datos:** mientras corre, cualquier otra petición recibe 503 `DEMO_RESTABLECIENDO`.
- **Alertas para R06:** `GET /api/alertas` y `/api/alertas/resumen` devuelven solo su almacén (el filtro `almacen` no lo saca de ahí), y `GET /api/alertas/:id` de otro almacén responde 403 `ALMACEN_AJENO`.
- **Frontend:** el menú y las pantallas siguen esta tabla. R01 entra a Artículos y a la ficha, pero solo ve la disponibilidad. La pestaña Umbrales del Centro de alertas la edita R07, la leen R08 y R09, y la bitácora de umbrales la ven R07 y R09.
- **R03 Asistente de pedidos (`AST-01`):** consulta (como los roles de lectura) y solo atiende AL11. No registra operaciones.
- **Diferencia al recibir un traslado:** queda como ajuste PENDIENTE con motivo `DIFERENCIA_RECEPCION` sobre el stock en tránsito, registrado por el R06 del destino. Solo R07 lo aprueba (la cantidad sale del tránsito como merma al costo FIFO) o lo rechaza (la mercadería pasa al destino y el R06 la recuenta). Este motivo no se puede registrar a mano.
- **Atender una alerta:** puede hacerlo uno de sus roles responsables (ver docs/ALERTAS.md) o R07. Un R06 solo atiende alertas de su almacén. R08 solo lee. AL11 la atiende R03 (`AST-01`) o R07.
- **R07** también puede registrar operaciones de almacén en los tres almacenes, porque la sección 11 le da alcance sobre los 3. Igual no puede aprobar lo que él mismo registró.
- **R02** propone promociones y consulta los envases sin devolver; **R08** solo lee.
- **R09** ve los usuarios (`GET /api/usuarios`), la bitácora, la fecha simulada y los eventos de integración, y es quien los reprocesa (AL16).
- Los permisos están en los decoradores `@Roles(...)` de cada controlador y en `exigirAlmacen()` (`backend/src/usuarios/autorizacion.ts`).
