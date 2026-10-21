# Trazabilidad de requisitos

Relaciona los requisitos del documento **«Detalle del ERP CBN»** (RF, RNF) y del **«Sistema de Inventarios del ERP CBN»** (alertas §7.2, políticas §13 y riesgos §10.2) con la pantalla o el endpoint del prototipo y la prueba que lo comprueba.

Las pruebas se nombran así:
- **U** — unitaria del backend (`backend/src/**/*.spec.ts`);
- **I** — integración del backend (`backend/test/*.e2e-spec.ts`, sobre la base `inventario_test`);
- **C** — componentes del frontend (Vitest);
- **H** — humo en el navegador (`frontend/e2e/*.spec.ts`);
- **R** — recorrido del guion (`frontend/e2e/recorrido.spec.ts`, escena n).

Estado:
- ✅ cubierto;
- ◐ cubierto con una simplificación (ver la nota final).

## Requisitos funcionales

| Req. | Qué pide | Pantalla / endpoint | Prueba | Estado |
|------|----------|---------------------|--------|--------|
| RF04 | Mostrar disponible, reservar al confirmar y generar despacho | Operaciones › Pedidos; `POST /api/pedidos`, `POST /api/pedidos/:id/despachar`; vista del preventista en Tablero | I `pedidos` 1–3; H `operaciones` a–b; R 4 | ✅ |
| RF05 | Envases retornables entregados y devueltos | Operaciones › Envases; `POST /api/envases` | I `cuarentena-envases` 8; H `operaciones` f | ✅ |
| RF11 | Valorar con FIFO y consultar el kardex | Ficha › Capas FIFO y Kardex; `GET /api/articulos/:codigo/capas`, `/kardex` | U `formulas`; I `pedidos` 1, `articulos-ficha`; R 3–4 | ✅ |
| RF12 | Perpetuo: stock y costo en cada movimiento; estados disponible, reservado, tránsito y envase | Tablero, Ficha › Posición; `GET /api/stock` | I `pedidos`, `traslados` 5, `operaciones-efecto` | ✅ |
| RF13 | ROP por artículo y almacén; alertar al alcanzarlo | Ficha › Parámetros; AL01 | U `formulas`, `evaluadores`; I `alertas-base` c, `parametros-permisos` 9; R 3–4 | ✅ |
| RF14 | Conteos cíclicos por ABC y ajustes aprobados por R07 | Operaciones › Conteo (ciego), Aprobaciones | I `conteos-ajustes` 6; H `operaciones` d; R 6 | ✅ |
| RF15 | Mermas, roturas y vencimientos con motivo y usuario | Operaciones › Ajustes y Cuarentena | I `conteos-ajustes`, `cuarentena-envases` 7 | ✅ |
| RF16 | Promociones vigentes; bonificación con costo FIFO | Operaciones › Promociones, Aprobaciones | I `pedidos` (bonificación), `alertas-base` (promociones); H `operaciones` g | ◐ |
| RF17 | Lote y vencimiento por entrada; FIFO; no despachar con < 15 días | Ficha › Capas; Operaciones › Recepción | I `pedidos` 4, `pedidos` (recepción); H `alertas-articulos` vi | ✅ |
| RF18 | Alertas AL01–AL16 con semáforo y quién las atendió | Centro de alertas, Tablero; `GET /api/alertas`, `/semaforo` | U `evaluadores`; I `alertas-base`, `alertas-tiempo`; H `alertas-articulos` i; R 2 | ✅ |
| RF19 | Fiestas: factor f, ROP de fiesta, traslados extraordinarios | Fiestas; `GET /api/fiestas/preparacion` | U `cronograma`; I `analisis`, `demo-analisis`; H `analisis-admin` ii; R 8 | ✅ |
| RF20 | Traslado propuesto (Máx − disponible − tránsito) y costos de conservación, pedido y agotamiento | Operaciones › Traslados, Costos; `GET /api/costos` | I `traslados` 5, `analisis` (costos); H `analisis-admin` iii; R 5, 9 | ◐ |

## Requisitos no funcionales

| Req. | Qué pide | Cómo se cumple | Prueba | Estado |
|------|----------|----------------|--------|--------|
| RNF06 | Integridad: stock, costo y pedido nunca descuadrados | Transacciones con candado por artículo y almacén; `GET /api/integridad` (6 comprobaciones); cada test termina verificando la integridad | I `pedidos` 3 (concurrencia), `demo-analisis` (integridad); R 10 | ✅ |
| RNF07 | Trazabilidad: usuario, fecha y motivo; nada se borra | Trigger `movimiento_inmutable` en PostgreSQL; bitácora de cambios; atención de alertas con usuario | I `parametros-permisos` 9, `alertas-base`; integridad «trigger activo» | ✅ |
| RNF14 | Alertas a tiempo, evaluadas en el movimiento y registradas | Evaluación tras cada operación (evento `inventario.cambio`), al cambiar la fecha y al arrancar; umbrales editables con bitácora | I `alertas-base` c, `alertas-tiempo`; H `humo` (+5 días) | ◐ |

## Alertas AL01–AL16 (§7.2)

Todas tienen su evaluador puro con pruebas de umbral (U `evaluadores`) y se ven en el Centro de alertas.

| Alerta | Qué vigila | Integración / navegador | Estado base |
|--------|-----------|-------------------------|-------------|
| AL01 | Reposición (posición ≤ ROP / ≤ SS) | I `alertas-base` c; R 4 | 4 |
| AL02 | Quiebre (vendible 0) | I `alertas-base` a; R 1 | 1 |
| AL03 | Exceso (> Máx) | I `alertas-base` a | 3 |
| AL04 | Vencimiento (≤ 30 / ≤ 15 días) | I `alertas-tiempo` b, `demo-analisis` (escenario); R 2, 7 | 2 |
| AL05 | Conteo atrasado | I `alertas-tiempo` b | 1 |
| AL06 | Diferencia de conteo | I `alertas-base` a, `conteos-ajustes` | 1 |
| AL07 | Ajuste sin aprobar | I `alertas-base` a | 1 |
| AL08 | Traslado sin recepción | I `alertas-base` a | 1 |
| AL09 | Diferencia en recepción | I `alertas-tiempo` e; R 5 | — |
| AL10 | Envases sin devolver | I `alertas-base` a | 2 |
| AL11 | Pedido con faltante sin revisar | I `alertas-tiempo` e, `analisis` (R03) | — |
| AL12 | Reserva sin despacho | I `alertas-tiempo` e | — |
| AL13 | Costo atípico en recepción | I `alertas-tiempo` e; H `operaciones` h | — |
| AL14 | Fiesta sin stock suficiente | I `alertas-tiempo` e; R 8 | 2 |
| AL15 | Promoción sin cobertura | I `alertas-base` a | 1 |
| AL16 | Falla de integración | I `alertas-tiempo` e (simulador y reproceso) | — |

## Políticas P01–P12 (§13)

| Pol. | Cómo la aplica el prototipo | Prueba | Estado |
|------|-----------------------------|--------|--------|
| P01 Alcance | Solo mercadería y envases retornables; sin producción ni compras | — (por diseño) | ✅ |
| P02 Perpetuo | Todo cambio de stock es un movimiento en el momento | I `pedidos`, `traslados` | ✅ |
| P03 FIFO | Consumo por capas; el método no se puede cambiar | U `formulas`; I `pedidos` 1; R 4 | ✅ |
| P04 Recepción | Traslados con tránsito; la entrada se da solo al recibir; diferencias registradas | I `traslados` 5; R 5 | ✅ |
| P05 Reserva y venta | Solo stock disponible; reserva en la misma transacción | I `pedidos` 2–3 | ✅ |
| P06 Reposición | ROP = d × L + SS; traslado hasta Máx; parámetros editables por R07 | I `parametros-permisos` 9; H `alertas-articulos` iv | ✅ |
| P07 Conteo | Conteo ciego por clase ABC; tolerancia 0.5%; quien cuenta no aprueba | I `conteos-ajustes` 6; R 6 | ✅ |
| P08 Ajustes y mermas | R06 registra, R07 aprueba; no se borran movimientos | I `conteos-ajustes`; trigger | ✅ |
| P09 Promociones | R02 propone; R07 aprueba con la referencia del correo; tope y vigencia | I `alertas-base` (promociones); H `operaciones` g | ◐ |
| P10 Vencimientos | No se despacha con < 15 días; cuarentena CUAR-01 | I `pedidos` 4, `cuarentena-envases` 7; R 7 | ✅ |
| P11 Fiestas | Factor f, ROP de fiesta y cronograma desde la semana de preparación | I `demo-analisis` (fiestas); R 8 | ✅ |
| P12 Alertas | Plazo, registro y escalamiento; umbrales editables con bitácora | I `alertas-tiempo` d, `alertas-base` (umbrales) | ◐ |

## Riesgos RI1–RI11 (§10.2)

| Riesgo | Mitigación en el prototipo | Prueba | Estado |
|--------|----------------------------|--------|--------|
| RI1 Faltantes y quiebre | ROP con SS por clase, AL01/AL02, traslado propuesto | I `alertas-base`, `traslados` 5 | ✅ |
| RI2 Diferencias sistema-bodega | Perpetuo, conteo ciego, AL06, aprobación separada | I `conteos-ajustes` | ✅ |
| RI3 Vencimiento | Capas con vencimiento, AL04, regla de 15 días, cuarentena | I `pedidos` 4, `cuarentena-envases`; R 7 | ✅ |
| RI4 Robo o salidas sin registro | Movimientos inmutables con almacén y ubicación; usuarios por almacén; Pareto de ajustes | I `conteos-ajustes` 6, `analisis` (Pareto) | ✅ |
| RI5 Traslados entre plantas | Almacén de tránsito, AL08, AL09 | I `traslados`; R 5 | ✅ |
| RI6 Costeo FIFO incorrecto | Costo obligatorio en la entrada; AL13 | I `alertas-tiempo` e, `pedidos` (recepción) | ✅ |
| RI7 Fiestas no previstas | Calendario, f, ROP de fiesta, AL14, traslados extraordinarios | I `demo-analisis`; R 8 | ✅ |
| RI8 Exceso de stock | Máx por artículo; AL03 | I `alertas-base` a | ✅ |
| RI9 Falla de integración | AL16 con simulador, cola de errores y reproceso | I `alertas-tiempo` e | ◐ |
| RI10 Envases no devueltos | Saldo por cliente; AL10 | I `cuarentena-envases` 8 | ✅ |
| RI11 Aprobador único | Un solo R07 con escalamiento de AL07 | I `alertas-base` a | ◐ |

## Simplificaciones (nota honesta)

- **Reloj en días.** La fecha simulada avanza por días completos; las alertas «cada hora» o «cada madrugada» (§7.3) se evalúan después de cada operación, al cambiar la fecha y al arrancar.
- **Sin contraseñas.** El usuario se elige con un selector y viaja en el encabezado `X-Usuario`. El backend valida igual los permisos por rol y por almacén.
- **Integración simulada.** No hay Business Central, M1 ni correo. AL16 usa un simulador de eventos con reintento y cola de errores, y la aprobación de promociones guarda una referencia de correo escrita a mano.
- **Un solo R07.** No hay suplentes ni permisos temporales (RI11); el escalamiento sube de nivel, pero no reasigna a otra persona.
- **Traslados de un artículo por orden.** Las órdenes de traslado del prototipo llevan una línea; los extraordinarios de una fiesta se emiten uno por artículo.
- **Historial sintético.** Los 90 días de despacho (lunes a sábado, sin feriados) son deterministas, no datos reales de CBN. Por eso la venta de junio del ART-10021 da 8,015 cajas, frente a las 7,920 del ejemplo del documento.
- **Rotación anualizada** con el factor 252/90 de la especificación, aunque el calendario de despacho tenga 6 días por semana.
- **Costos de pedido y agotamiento** salen de los traslados y faltantes registrados en el prototipo, con las tasas editables de la pantalla Costos.
