# 02 · Recorrido práctico por la aplicación

**Qué vas a aprender**
- A usar cada pantalla con el usuario correcto.
- A leer los números que da el sistema y explicar **por qué** salen así.

**Antes de empezar:** sistema encendido ([capítulo 00](00-como-usar.md)) y datos restablecidos. Las prácticas están pensadas **en este orden**: algunas usan el resultado de la anterior (por ejemplo, la 8 cuenta lo que quedó después de la 5). El usuario se cambia arriba a la derecha y el almacén, arriba a la izquierda.

Todos los números de este capítulo se comprobaron contra la API con los datos del 30/06/2027.

| # | Práctica | Usuario |
|---|----------|---------|
| 1 | Tablero y semáforo | LOG-01 |
| 2 | Atender una alerta | LOG-01 |
| 3 | Ficha del ART-10021 | LOG-01 |
| 4 | Un pedido que no alcanza y otro que sí | PV-014 |
| 5 | Despacho FIFO de 600 cajas | LOG-01 |
| 6 | Despacho que salta una capa por vencer | LOG-01 |
| 7 | Traslado completo con diferencia | LOG-01, ALM-SC, ALM-LP |
| 8 | Conteo ciego y ajuste | ALM-LP → LOG-01 |
| 9 | Quien registra no aprueba | ALM-LP, LOG-01 |
| 10 | Cuarentena | ALM-LP → LOG-01 |
| 11 | Envases retornables | ALM-LP |
| 12 | Avanzar la fecha simulada | LOG-01 |
| 13 | Fiestas y cronograma | LOG-01 |
| 14 | ABC y Pareto | LOG-01 |
| 15 | Los cuatro costos | LOG-01 |
| 16 | Integridad y restablecimiento | TI-01 |

---

## Práctica 1 · El Tablero y el semáforo
- **Objetivo:** leer el estado general del inventario.
- **Usuario / almacén:** LOG-01 · Todos.
- **Pasos:** menú *Tablero*.
- **Lo que debes ver:**
  - fecha **30/06/2027**; **19 alertas vigentes** (5 rojas, 11 amarillas, 3 azules);
  - la campana con un **5** (rojas sin atender);
  - valor del inventario **USD 78,535.66**;
  - artículos: 1 en quiebre, 4 bajo ROP, 3 con exceso y 1 próximo a vencer (de 21 combinaciones artículo-almacén);
  - cobertura media **7.1 días**;
  - **1** traslado en tránsito (210 u.) y **2** ajustes pendientes;
  - exactitud **93.3%** (14 de 15 conteos sin diferencia);
  - en el semáforo, La Paz · ART-10048 está en rojo con **AL02**.
- **Por qué pasa:** el backend recorre las capas y los movimientos y calcula todo al pedirlo; nada está escrito a mano en la pantalla. El color de cada celda es el de su alerta más grave.
- **Comprueba:** cambia al usuario **PV-014**. ¿Qué desaparece y por qué? *(respuesta 1)*

## Práctica 2 · El Centro de alertas y cómo se atiende una
- **Usuario:** LOG-01.
- **Pasos:**
  1. *Alertas* → filtro «Tipo de alerta: Vencimiento» → quedan **2** AL04.
  2. Haz clic en la roja: «Lote LP-10063-270113 (40 u.) con **12 días** de vida ≤ 15: ya no se despacha.»
  3. En el panel: Resultado «Lote en liquidación o cuarentena» → «Atender alerta».
- **Lo que debes ver:** «Atendida por LOG-01». La píldora pasa de **19** a **18 sin atender**, y las rojas sin atender bajan de 5 a 4. El total sigue en **19**.
- **Por qué pasa:** *atender* no es *resolver*. Atender registra quién hizo algo y qué hizo; la alerta solo se **resuelve** cuando desaparece la condición (en la práctica 10 la capa se mueve a cuarentena).
- **Comprueba:** ¿por qué el total no bajó a 18? *(respuesta 2)*

## Práctica 3 · La ficha del ART-10021
- **Pasos:** *Artículos* → **ART-10021**.
- **Lo que debes ver (La Paz):**
  - disponible **920**, reservado **160**, cobertura **7.7 días**;
  - tres capas de **360** cajas en PICK-A con costos **12.40 / 12.52 / 12.65**; la de 12.40 dice «Próxima en salir»;
  - fórmulas: `SS = Z × σd × √L = 2.05 × 17 × √3 = 60` y `ROP = d × L + SS = 120 × 3 + 60 = 420`; Q **840**, Máx **1,260**.
- **Por qué pasa:** las fórmulas se muestran con los números que calcula el backend; el navegador no recalcula nada ([capítulo 05](05-formulas.md)).
- **Comprueba:** si el disponible es 920 y hay 1,080 cajas físicas, ¿dónde están las otras 160? *(respuesta 3)*

## Práctica 4 · Un pedido que no alcanza y otro que sí
- **Usuario:** PV-014 · CD-LP-01.
- **Pasos:**
  1. *Operaciones* → *Pedidos*. Artículo ART-10035: «Vendible hoy: 20». Cantidad **30** → «Crear pedido y reservar».
  2. Cambia la cantidad a **15** y vuelve a crear el pedido.
- **Lo que debes ver:**
  - primer pedido: aviso de faltante de **10** y «quedó pendiente de revisión». La API responde **409** `STOCK_INSUFICIENTE`, con el detalle `solicitado 30, disponible 20, faltante 10`;
  - segundo pedido: «confirmado: stock reservado».
- **Por qué pasa:** el pedido es **todo o nada**. Si una línea no alcanza, no reserva nada y el pedido queda `PENDIENTE_REVISION`. Así nunca se promete stock que no existe (política P05).
- **Comprueba:** ¿qué alerta se encargaría de ese pedido pendiente si nadie lo revisa? *(respuesta 4)*

## Práctica 5 · Despacho FIFO de 600 cajas
- **Usuario:** LOG-01 · CD-LP-01.
- **Pasos:**
  1. *Operaciones* → *Pedidos* → ART-10021, cantidad **600** → «Crear pedido y reservar».
  2. En la fila del pedido, «Despachar».
- **Lo que debes ver:**
  - al reservar nace **AL01** amarilla: «Posición 320 ≤ ROP 420. Traslado propuesto: 940.»
  - al despachar, las capas que salieron son **360 × 12.40 = USD 4,464.00** y **240 × 12.52 = USD 3,004.80**; costo FIFO total **USD 7,468.80**.
- **Por qué pasa:**
  - La reserva baja el disponible: 920 − 600 = 320 ≤ 420, así que la alerta nace al **reservar**.
  - El despacho agota la capa más antigua (360) y toma 240 de la siguiente.
  - El traslado propuesto es Máx − posición = 1,260 − 320 = 940.
- **Comprueba:** ¿cuánto habría costado con el costo de la capa más **nueva** (LIFO)? *(respuesta 5)*

## Práctica 6 · Un despacho que salta una capa de menos de 15 días
- **Usuario:** LOG-01 · CD-LP-01.
- **Pasos:** crea un pedido de **20** cajas de **ART-10063** (Bock) y despáchalo.
- **Lo que debes ver:** sale de la capa **LP-10063-270126** (20 × 12.93, vence 25/07/2027), **no** de la LP-10063-270113, que es más antigua pero tiene 12 días de vida. En la ficha del ART-10063, esa capa dice «No despachable · Menos de 15 días de vida».
- **Por qué pasa:** el despacho pide a `consumir()` solo capas que venzan después de *hoy + 15 días* ([capítulo 04](04-fifo.md)).
- **Comprueba:** ¿FIFO se rompe aquí? *(respuesta 6)*

## Práctica 7 · Un traslado completo con diferencia en la recepción
1. **LOG-01** · CD-LP-01:
   - *Operaciones* → *Traslados* → *Propuestas* → ART-10035 → «Crear traslado»;
   - cantidad **100**, origen **CD-SC-01** → «Emitir traslado». Se emite **OT-2027-0002** en estado `EMITIDA`.
2. **ALM-SC:** *Traslados* → «Despachar desde CD-SC-01».
   - Sale la capa SC-10035-270419 (100 × 14.10) y el estado pasa a `EN_TRANSITO`.
   - La AL01 del ART-10035 en La Paz cambia de **rojo a amarillo**: la posición ahora incluye lo que viene en camino.
3. **ALM-LP:** «Recibir en CD-LP-01» → recibido **95** → aviso «Diferencia de 5» → «Confirmar recepción».
   - Estado `CON_DIFERENCIA`; nace **AL09** roja: «diferencia 5 de 100 (5%) > 1%».
4. **LOG-01:** *Aprobaciones* → bandeja de diferencias → el ajuste de −5 → «Aprobar».
   - Se resuelve la AL09 y las 5 cajas se dan de baja al costo de su capa (5 × 14.10).

- **Por qué pasa:** la mercadería nunca «desaparece»: va del origen al **tránsito**, y solo entra al destino con la recepción confirmada (P04). La diferencia queda como ajuste pendiente hasta que alguien con autoridad decide.
- **Comprueba:** ¿por qué cambió el color de AL01 *antes* de que llegara el camión? *(respuesta 7)*

## Práctica 8 · El conteo ciego y su ajuste
- **Pasos:**
  1. **ALM-LP:** *Operaciones* → *Conteo*, ART-10021 en PICK-A. La pantalla dice que **no se muestra el saldo del sistema**. Escribe **474** → «Registrar conteo».
  2. **LOG-01:** abre el ajuste (enlace del resultado o *Aprobaciones*) → «Aprobar».
- **Lo que debes ver:**
  - «Conteo registrado con diferencia»: sistema **480** (1,080 − 600 de la práctica 5), contado 474, diferencia −6 (**1.25%**);
  - nace **AL06** amarilla («> 0.5%»);
  - al aprobar sale **6 × 12.52 = USD 75.12** por FIFO y se resuelve la AL06.
- **Por qué pasa:** el conteo es **ciego** para que quien cuenta no «acomode» el número. La tolerancia es 0.5%: 1.25% la supera, así que se crea un ajuste pendiente.
- **Comprueba:** ¿por qué sale a 12.52 y no a 12.40? *(respuesta 8)*

## Práctica 9 · Por qué quien registra no aprueba
- **Pasos:**
  1. Repite la práctica 8 y, antes de cambiar de usuario, haz clic en el enlace del ajuste con **ALM-LP**.
  2. Por la API (lo verás en el [capítulo 08](08-retos.md), reto 3), LOG-01 puede registrar un ajuste propio e intentar aprobarlo.
- **Lo que debes ver:**
  - ALM-LP: «Tu rol no tiene acceso a esta sección». La API responde **403** `SIN_PERMISO`: «El rol R06 (ALM-LP) no puede realizar esta operación».
  - LOG-01 con su propio ajuste: **403** `AUTOAPROBACION`: «Quien registra un ajuste o merma no puede aprobarlo ni rechazarlo».
- **Por qué pasa:** es **segregación de funciones**, del control interno ([capítulo 07](07-datos-permisos.md)). Si la misma persona pudiera contar, ajustar y aprobar, podría esconder un robo.
- **Comprueba:** ¿qué dos reglas distintas detienen a ALM-LP y a LOG-01? *(respuesta 9)*

## Práctica 10 · Cuarentena
- **Pasos:**
  1. **ALM-LP:** *Operaciones* → *Cuarentena* → capa **LP-10063-270113** → cantidad **40** → «Mover a CUAR-01».
  2. Busca el botón «Liberar» con ALM-LP (no aparece) y luego con **LOG-01** (sí aparece).
- **Lo que debes ver:**
  - la capa aparece en *Capas en cuarentena*; se **resuelve** la AL04 roja de la práctica 2;
  - con ALM-LP no hay «Liberar»: la API respondería 403.
- **Por qué pasa:**
  - La cuarentena es un movimiento con dos patas: −40 en PICK-A y +40 en CUAR-01. El stock físico del almacén no cambia, pero ya no es vendible.
  - Liberar es decisión de R07.
- **Comprueba:** si mueves solo 15 de las 40, ¿qué le pasa a la capa? *(respuesta 10)*

## Práctica 11 · Envases retornables
- **Usuario:** ALM-LP.
- **Pasos:** *Operaciones* → *Envases* → ART-10021, Cliente 001, cantidad **10** → «Registrar devolución». Después intenta devolver **100**.
- **Lo que debes ver:**
  - el pendiente del Cliente 001 baja de **40 a 30**;
  - con 100: **409** `DEVOLUCION_EXCEDE`, «Cliente 001 solo tiene 30 envases pendientes de ART-10021».
  - El Cliente 003 tiene 50 envases pendientes desde hace 76 días: esa es la **AL10** roja (> 60 días).
- **Por qué pasa:** los envases se controlan por **cantidad** y por cliente, con movimientos `ENVASE_*`, que son de control y no mueven el stock de cerveza.
- **Comprueba:** ¿por qué la AL10 del Cliente 002 es amarilla y no roja? *(respuesta 11)*

## Práctica 12 · El avance de la fecha simulada y los vencimientos
- **Primero restablece los datos.** Usuario: LOG-01.
- **Pasos:** en el campo de fecha de la barra superior, elige **05/07/2027** (+5 días). Luego «Restablecer al 30/06/2027».
- **Lo que debes ver:**
  - aviso de cuántas alertas cambiaron; el contador pasa de 19 a **25** (13 rojas);
  - la capa de 12 días ahora tiene **7**, y la de 25, **20**;
  - aparecen AL12 rojas (reservas sin despacho hace 120 h) y AL07 (ajuste pendiente > 48 h);
  - al restablecer la fecha vuelven las **19**.
- **Por qué pasa:** todo lo que depende del tiempo usa la **fecha simulada**, nunca el reloj real. Al cambiarla se reevalúan todas las alertas.
- **Comprueba:** ¿qué alerta de la tabla anterior *no* depende del stock sino del tiempo? *(respuesta 12)*

> Rareza observada: después de volver al 30/06, la píldora «escaladas» del Centro de alertas sigue en 5. Restablecer los datos la deja en 0. Está anotada en la [lista de rarezas](09-defensa.md#rarezas-conocidas-del-prototipo).

## Práctica 13 · Fiestas y cronogramas
- **Usuario:** LOG-01.
- **Pasos:** *Fiestas* → «Aniversario de La Paz y Día de la Patria».
- **Lo que debes ver:**
  - 16/07–06/08, f = **1.3**, faltan **16 días**, estado **Crítico**;
  - cronograma: «4 semanas antes» hecho; «**3 semanas antes**» en curso (25/06–01/07, revisar vencimientos);
  - en La Paz:

    | Artículo | Pronóstico | Posición | Brecha | Estado | Detalle |
    |----------|------------|----------|--------|--------|---------|
    | ART-10035 | 117 | 20 | 97 | Crítico | ROP fiesta `45 × 1.3 × 3 + 23 × 1.3 = 205` |
    | ART-10048 | 91 | 0 | 91 | Crítico | |
    | ART-10021 | | | | OK | ROP fiesta 546 |

  - Con «Crear traslados extraordinarios» se prellenan los traslados con la brecha de cada artículo.
- **Por qué pasa:** cada fiesta tiene un factor estacional *f* que sube la demanda. El cronograma se calcula con la fecha simulada (P11).
- **Comprueba:** «Ver la fiesta como si estuviera cerca» mueve la fecha al 18/06. ¿Qué le pasa al hito «3 semanas antes»? *(respuesta 13)*

## Práctica 14 · Análisis ABC y Pareto
- **Pasos:** *Análisis*.
- **Lo que debes ver:**

  | Artículo | Venta diaria | Acumulado | Clase |
  |----------|--------------|-----------|-------|
  | ART-10021 | USD 2,244 | 35.36% | A |
  | ART-10022 | USD 1,533 | 59.52% | A |
  | ART-10035 | USD 963 | **74.69%** | A |
  | ART-10048 | | 84.73% | B (pasa el 80%) |

  El Pareto de ajustes está vacío en el estado base: no hay ajustes aprobados. Se llena después de las prácticas 7 y 8.
- **Por qué pasa:** venta diaria = precio × d (por ejemplo, 18.70 × 120 = 2,244), ordenada de mayor a menor. Se corta en 80% y 95%.
- **Comprueba:** ¿por qué importa que un artículo sea A? *(respuesta 14)*

## Práctica 15 · Los cuatro costos
- **Pasos:** *Costos* → almacén **LP** → junio 2027.
- **Lo que debes ver** (ART-10021, estado base):
  - adquisición **USD 35,369.31** (2,865 cajas vendidas);
  - stock promedio 923 cajas = USD 11,432.66;
  - conservación **USD 142.91**;
  - pedido y agotamiento en 0.
  - Con «Todos»: **8,015 cajas** y **USD 98,953.07**.
- **Por qué pasa:**
  - **adquisición** = costo FIFO de lo vendido;
  - **conservación** = valor del stock promedio × 15% ÷ 12 = 11,432.66 × 0.15 ÷ 12 = 142.91;
  - **pedido** = USD 180 por traslado;
  - **agotamiento** = pedidos con faltante × margen perdido.

  Las tasas se editan en «Parámetros», con vista previa.
- **Comprueba:** después de la práctica 5, ¿cuánto sube la adquisición de junio con «Todos»? *(respuesta 15)*

## Práctica 16 · Integridad y restablecimiento
- **Usuario:** TI-01.
- **Pasos:** *Administración* → «Verificar integridad» → «Restablecer datos» → escribe `RESTABLECER`.
- **Lo que debes ver:**
  - **6 comprobaciones en ✔**:
    - Σ capas = Σ movimientos (22 combinaciones);
    - sin saldos negativos (268 capas);
    - vencimiento posterior a la elaboración;
    - un lote, un costo;
    - trigger activo (2,368 movimientos);
    - reservado = Σ reservas.
  - Al restablecer: «30/06/2027, 19 alertas vigentes» en menos de un segundo.
- **Por qué pasa:** la integridad compara dos fuentes independientes (las capas y el libro de movimientos). Si alguna vez no coinciden, hay un error. Restablecer vuelve a sembrar y verifica.
- **Comprueba:** ¿por qué la API rechaza el restablecimiento sin la palabra `RESTABLECER`? *(respuesta 16)*

---

## Respuestas

1. Desaparecen las alertas, los costos (USD) y menús como *Alertas* y *Costos*. El preventista (R01) solo necesita saber si hay stock; además, la API le responde **403** al resumen del tablero.
2. Porque la alerta sigue **vigente**: se atendió, pero la capa sigue por vencer. Vigente = abierta o atendida.
3. Reservadas: 1,080 físicas − 160 reservadas = 920 disponibles.
4. **AL11** (pedido pendiente por falta de stock, responsable R03): amarilla después de 2 h y roja después de 24 h sin revisar.
5. Con LIFO saldrían 360 × 12.65 + 240 × 12.52 = 4,554.00 + 3,004.80 = **USD 7,558.80**: USD 90 más caro.
6. No. FIFO se aplica entre las capas **utilizables**. La regla de 15 días (P10) retira antes esa capa de la cola.
7. Porque la alerta mira la **posición** (disponible + tránsito). Al despacharse el traslado, la posición sube de 5 a 105, que ya no está por debajo del SS (23), aunque sí del ROP (158).
8. Porque la capa de 12.40 ya se agotó en la práctica 5: la más antigua con saldo es la de 12.52.
9. ALM-LP choca con el **rol** (solo R07 aprueba ajustes). LOG-01 choca con la **autoaprobación** (nadie aprueba lo que registró).
10. Se **divide**: queda una capa de 25 en PICK-A y se crea otra de 15 en CUAR-01, con el mismo lote, costo y vencimiento.
11. El Cliente 002 lleva 41 días: más de 30 (amarilla), pero menos de 60 (roja).
12. AL12 (reserva sin despacho) y AL07 (ajuste pendiente): miden **horas** desde el registro.
13. Pasa de «En curso» a «Próximo»: a 4 semanas de la fiesta todavía no le toca.
14. La clase A tiene un nivel de servicio del 98% (SS más alto) y se cuenta cada mes.
15. Sube exactamente USD 7,468.80: a **8,615 cajas** y **USD 106,421.87**.
16. Porque es una acción destructiva: borra todo lo hecho. Pedir la palabra evita un clic accidental, y además solo funciona con `DEMO_MODE=true`.

## Ideas para recordar
- Cada número de la pantalla lo calcula el backend a partir de capas y movimientos.
- Reservar baja el disponible; despachar consume capas FIFO y fija el costo.
- Las diferencias (traslado, conteo) se vuelven ajustes que otra persona aprueba.
- Atender ≠ resolver: una alerta se resuelve sola cuando desaparece su causa.
- La fecha simulada gobierna vencimientos, fiestas y escalamiento.

---
Anterior: [← 01 · Ideas clave](01-ideas-clave.md) · [Índice](README.md) · Siguiente: [03 · Arquitectura →](03-arquitectura.md)
