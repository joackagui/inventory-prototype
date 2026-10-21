# Permisos por rol

Sin contraseñas: cada petición lleva el encabezado `X-Usuario` con el código del usuario (por ejemplo `ALM-LP`). El guard `UsuarioGuard` carga el usuario y su rol:
- **401 `NO_AUTENTICADO`:** falta el encabezado o el usuario no existe.
- **403 `SIN_PERMISO`:** el rol no tiene permiso para esa ruta.
- **403 `ALMACEN_AJENO`:** un R06 intenta operar un almacén que no es el suyo.
- **403 `AUTOAPROBACION`:** quien registró un ajuste o merma intenta aprobarlo o rechazarlo, aunque tenga el rol.

Usuarios: `PV-014` (R01) · `SUP-01` (R02) · `ALM-LP`, `ALM-CB`, `ALM-SC` (R06, cada uno su almacén) · `LOG-01` (R07) · `GER-01` (R08) · `TI-01` (R09).

✔ = permitido · ✔¹ = solo en su almacén asignado · — = 403

| Método y ruta | R01 | R02 | R06 | R07 | R08 | R09 |
|---|---|---|---|---|---|---|
| `GET /api/salud`, `GET /api/usuarios`, `/api/docs` | público | público | público | público | público | público |
| `GET /api/yo`, `/api/almacenes`, `/api/fiestas`, `/api/simulacion/fecha`, `/api/pedidos` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/stock?almacenId=` | ✔ solo disponible/agotado, sin costos | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/articulos`, `/articulos/:codigo/capas`, `/articulos/:codigo/kardex`, `/api/abc`, `/api/movimientos`, `/api/traslados`, `/api/traslados/propuesta`, `/api/ajustes`, `/api/conteos`, `/api/envases/saldos`, `/api/configuracion` | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| `POST /api/pedidos` (reserva) | ✔ | — | — | — | — | — |
| `POST /api/pedidos/:id/cancelar` | ✔ | — | ✔¹ | ✔ | — | — |
| `POST /api/pedidos/:id/despachar` | — | — | ✔¹ | ✔ | — | — |
| `POST /api/operaciones/recepcion` | — | — | ✔¹ | ✔ | — | — |
| `POST /api/conteos` | — | — | ✔¹ | ✔ | — | — |
| `POST /api/ajustes` (ajuste o merma, queda PENDIENTE) | — | — | ✔¹ | ✔ | — | — |
| `POST /api/ajustes/:id/aprobar` y `/rechazar` | — | — | — | ✔ (no el que lo registró) | — | — |
| `POST /api/cuarentena` | — | — | ✔¹ | ✔ | — | — |
| `POST /api/cuarentena/:capaId/liberar` | — | — | — | ✔ | — | — |
| `POST /api/envases/entrega` y `/devolucion` | — | — | ✔¹ | ✔ | — | — |
| `POST /api/traslados` (emitir) | — | — | — | ✔ | — | — |
| `POST /api/traslados/:id/despachar` | — | — | ✔ origen | ✔ | — | — |
| `POST /api/traslados/:id/recibir` | — | — | ✔ destino | ✔ | — | — |
| `PUT /api/parametros/:articulo/:almacen`, `POST /api/abc/recalcular` | — | — | — | ✔ | — | — |
| `PUT /api/configuracion/:clave` (umbrales, tasas, tolerancia) | — | — | — | ✔ | — | — |
| `PUT /api/simulacion/fecha`, `POST /api/simulacion/avanzar`, `POST /api/simulacion/restablecer` | — | — | — | ✔ | — | ✔ |
| `GET /api/integridad`, `GET /api/bitacora` | — | — | — | ✔ | — | ✔ |
| `GET /api/alertas`, `/api/alertas/resumen`, `/api/alertas/:id`, `/api/alertas/umbrales`, `/api/semaforo`, `/api/promociones` | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| `POST /api/alertas/:id/atender` | — | ✔ si es responsable | ✔ si es responsable y de su almacén | ✔ | — | ✔ si es responsable (AL16) |
| `POST /api/alertas/evaluar` | — | — | — | ✔ | — | ✔ |
| `PUT /api/alertas/umbrales/:clave` | — | — | — | ✔ | — | — |
| `POST /api/promociones` (propuesta) | — | ✔ | — | — | — | — |
| `POST /api/promociones/:id/aprobar` (con `referenciaCorreo`) y `/cerrar` | — | — | — | ✔ | — | — |
| `POST /api/simulacion/falla-integracion`, `GET /api/integracion/eventos` | — | — | — | ✔ | — | ✔ |
| `POST /api/integracion/eventos/:id/reprocesar` | — | — | — | — | — | ✔ |

Notas:
- **Diferencia al recibir un traslado:** queda como ajuste PENDIENTE con motivo `DIFERENCIA_RECEPCION` sobre el stock en tránsito, registrado por el R06 del destino. Solo R07 lo aprueba (la cantidad sale del tránsito como merma al costo FIFO) o lo rechaza (la mercadería pasa al destino y el R06 la recuenta). Este motivo no se puede registrar a mano.
- **Atender una alerta:** puede hacerlo uno de sus roles responsables (ver docs/ALERTAS.md) o R07. Un R06 solo atiende alertas de su almacén. R08 solo lee. AL11 es de R03, que no existe como usuario, así que en la práctica la atiende R07.
- **R07** también puede registrar operaciones de almacén en los tres almacenes, porque la sección 11 le da alcance sobre los 3. Igual no puede aprobar lo que él mismo registró.
- **R02** propone promociones y consulta los envases sin devolver; **R08** solo lee.
- **R09** ve los usuarios (`GET /api/usuarios`), la bitácora, la fecha simulada y los eventos de integración, y es quien los reprocesa (AL16).
- Los permisos están en los decoradores `@Roles(...)` de cada controlador y en `exigirAlmacen()` (`backend/src/usuarios/autorizacion.ts`).
