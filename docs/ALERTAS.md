# Alertas (semáforo)

Motor: `backend/src/alertas/`.
- **Evaluadores puros** (`evaluadores.ts`): una función por alerta, con tests de umbrales.
- **Evaluación contra la base** (`evaluacion.ts`): consulta los datos, aplica los evaluadores y sincroniza el ciclo de vida.
- **API** (`alertas.service.ts`).

Todo usa la **fecha simulada**: 1 día simulado = 24 h. Los umbrales están en `ConfiguracionSistema.umbralesAlertas` y se editan con `PUT /api/alertas/umbrales/:clave`.

Colores: 🔴 rojo = crítico · 🟡 amarillo = atención · 🔵 azul = informativo · verde = sin alertas.

| Cód. | Evaluador | Qué mide | Amarillo / azul | Rojo | Rol responsable | Se evalúa |
|---|---|---|---|---|---|---|
| AL01 | `al01` | Posición (disponible + tránsito) vs. ROP y SS | posición ≤ ROP | posición ≤ SS | R07 | por artículo y almacén |
| AL02 | `al02` | Stock vendible (capas con ≥ 15 días de vida − reservado) | — | vendible = 0 | R07 (aviso a R02) | por artículo y almacén |
| AL03 | `al03` | Disponible vs. Máx | > Máx (azul) | > 2 × Máx | R07 | por artículo y almacén |
| AL04 | `al04` | Vida restante **de cada capa** DISPONIBLE | ≤ 30 días | ≤ 15 días | R06 | por artículo y almacén |
| AL05 | `al05` | Días desde el último conteo vs. frecuencia (A 30, B 90, C 180) | > frecuencia | > frecuencia + 7 | R06 | por artículo y almacén |
| AL06 | `al06` | % del conteo con ajuste pendiente | > 0.5% | > 2% | R06 recuenta, R07 aprueba | por artículo y almacén |
| AL07 | `al07` | Horas de un ajuste o merma PENDIENTE | > 24 h | > 48 h | R07 | siempre completa |
| AL08 | `al08` | Días en tránsito vs. L del destino | > L + 1 | > L + 2 | R06 del destino | siempre completa |
| AL09 | `al09` | Diferencia o daño al recibir un traslado | diferencia ≤ 1% | > 1% o dañado | R06, decide R07 | siempre completa |
| AL10 | `al10` | Antigüedad de envases sin devolver, por cliente y envase | > 30 días | > 60 días | R06 y R02 | siempre completa |
| AL11 | `al11` | Horas de un pedido PENDIENTE_REVISION | > 2 h | > 24 h | R03 | siempre completa |
| AL12 | `al12` | Horas de una reserva (pedido CONFIRMADO) sin despacho | > 24 h | > 48 h | R06 | siempre completa |
| AL13 | `al13` | Costo de una capa con saldo vs. la capa anterior | variación > 10% | > 15% | R07 | por artículo y almacén |
| AL14 | `al14` | Fiesta de la zona vs. posición y pronóstico (d × f × días) | faltan ≤ 21 días y no alcanza | faltan ≤ 7 días y no alcanza | R07 | por artículo y almacén |
| AL15 | `al15` | Promoción ACTIVA vigente: cobertura (vendible ÷ d) vs. días restantes | cobertura < días restantes | vendible = 0 | R02 y R07 | por artículo y almacén |
| AL16 | `al16` | Eventos de integración simulados | REINTENTO | COLA_ERRORES | R09 | siempre completa |

Cada alerta guarda:
- código, color y mensaje con el valor medido y el umbral;
- roles responsables, acción sugerida y datos de apoyo (JSON);
- referencia al registro que la origina: artículo, capa, conteo, ajuste, traslado, cliente, pedido, fiesta, promoción o evento.

## Cuándo se evalúa
1. **Después de cada operación confirmada:** se escucha el evento `inventario.cambio`.
   - Se evalúan las alertas «por artículo y almacén» solo del par afectado.
   - Las de documentos (AL07–AL12 y AL16) se evalúan siempre completas.
   - La respuesta HTTP sale cuando la evaluación ya terminó.
2. **Al cambiar la fecha simulada** (`PUT /fecha`, `/avanzar`, `/restablecer`): evaluación completa.
3. **Al simular o reprocesar un evento de integración, o al cambiar un umbral:** evaluación completa.
4. **A mano**, con `POST /api/alertas/evaluar` (R07, R09).
5. **Al arrancar el backend.** El seed también deja evaluadas las alertas del estado base.

Las evaluaciones son **idempotentes** (evaluar dos veces no cambia nada) y corren **en serie**: un candado `pg_advisory_xact_lock` dentro de una transacción.

## Ciclo de vida
- **Una alerta vigente por clave:** `código|almacén|artículo|referencia`. Un índice único parcial lo impone.
- **Cambio de color:** se actualiza la misma alerta y se guarda en el historial (`CAMBIO_COLOR`, con fecha simulada).
- **Atender** (`POST /api/alertas/:id/atender {resultado, comentario}`):
  - quién puede: el rol responsable (R06 solo si la alerta es de su almacén) o R07;
  - se guarda quién, cuándo (fecha simulada) y el resultado;
  - atender **no** cierra la alerta: sigue visible como «atendida, condición vigente».
- **Resolución automática:** cuando la condición desaparece, la alerta pasa a `RESUELTA`. Si nadie la había atendido, su resultado es «condición normalizada»; si estaba atendida, conserva el resultado de la atención.
- **Escalamiento:** se aplica a una alerta ROJA, ABIERTA y sin atender, contando desde que se puso en rojo.
  - más de 24 h → nivel 1 (R07 Coordinador de logística);
  - más de 48 h → nivel 2 (Gerente de Logística y Ventas);
  - cada escalamiento queda en el historial. El nivel no baja, aunque la fecha simulada retroceda.

## Decisiones
- **AL04 por capa:** cada lote con poca vida es una decisión distinta (liquidar, poner en cuarentena), así que una alerta por capa. Ejemplo: el ART-10063 de La Paz tiene dos alertas, una roja (40 cajas, 12 días) y otra amarilla (110 cajas, 25 días).
- **AL01 se omite cuando hay AL02:** con quiebre, AL02 ya informa el traslado propuesto.
- **AL06** sigue vigente mientras el ajuste de su conteo esté PENDIENTE.
- **AL09** sigue vigente mientras la diferencia esté pendiente de decisión, o mientras lo recibido dañado siga en cuarentena.
- **AL13** compara cada capa con saldo contra la capa anterior del mismo artículo y almacén, y omite las divisiones del mismo lote. Se resuelve cuando esa capa se agota.
- **Horas medidas en días simulados:** AL11 (> 2 h) no salta el mismo día del pedido; aparece en amarillo al día simulado siguiente (24 h) y en rojo al segundo día (48 h).
- **Alertas de documentos en la planta:** las de un almacén de tránsito (ajustes de diferencia en recepción) se muestran en la planta destino. AL16 no tiene almacén.
- **Semáforo** (`GET /api/semaforo`): el color de cada artículo es el de su alerta vigente más grave, incluidas AL10 (envases de ese artículo) y AL07.
