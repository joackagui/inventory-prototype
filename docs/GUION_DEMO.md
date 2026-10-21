# Guion de la demo · Inventario CBN (10–12 minutos)

Prototipo del sistema de inventarios del ERP de CBN. Todos los números de este guion salen del escenario sembrado al 30/06/2027 y los comprueba `npm run test:recorrido`. Las referencias «§» apuntan al documento **«Sistema de Inventarios del ERP CBN»** (fase conceptual).

## Checklist previa (15 minutos antes)

- [ ] Docker Desktop abierto (ballena quieta en la barra de menú).
- [ ] `npm run demo:iniciar` termina con «✅ Demo lista» e «Integridad OK (268 capas)».
- [ ] Navegador en http://localhost:5173, zoom 100%, pantalla completa (Ctrl + Cmd + F).
- [ ] **Modo presentación** activado (botón de la barra superior) y tema claro u oscuro según la sala.
- [ ] Tablero muestra **30/06/2027** y **19 alertas vigentes**. Si no: Administración → «Restablecer datos».
- [ ] Una segunda pestaña abierta en Administración con **TI-01** (plan B).
- [ ] Notificaciones del sistema silenciadas (No molestar).

Los cambios de usuario se hacen con el selector de la esquina superior derecha (no hay contraseñas).

## Escenas

| # | Escena | Tiempo |
|---|--------|--------|
| 1 | Tablero | 1:00 |
| 2 | Centro de alertas | 1:00 |
| 3 | Ficha del ART-10021 | 1:15 |
| 4 | Pedido y despacho FIFO | 1:15 |
| 5 | Reposición completa con diferencia | 1:30 |
| 6 | Conteo ciego y ajuste | 1:00 |
| 7 | Vencimientos y cuarentena | 0:45 |
| 8 | Fiestas | 1:15 |
| 9 | Análisis y costos | 1:00 |
| 10 | Administración | 0:45 |
| | **Total** | **≈ 10:45** |

### 1. Tablero — LOG-01 (Coordinador de logística, R07)

- **Qué hago:** abro *Tablero* con «Todos».
- **Qué se ve:**
  - fecha simulada **30/06/2027**;
  - **19 alertas vigentes**: 5 rojas, 11 amarillas y 3 azules; la campana marca **5** (rojas sin atender);
  - KPIs: valor del inventario **USD 78,535.66**, **1** en quiebre, **4** bajo ROP, **3** con exceso, **1** próximo a vencer, cobertura media **7.1 días**, **1** traslado en tránsito (**210** u.), **2** ajustes pendientes, exactitud **93.3%** (14 de 15 conteos);
  - en el semáforo, La Paz · ART-10048 en rojo con **AL02** (disponible 0).
- **Qué digo:** «Es la torre de control del inventario: stock, costo y alertas de las tres plantas, calculados en el momento desde los movimientos (sistema perpetuo, §6.2). El color nunca va solo: cada semáforo tiene ícono y texto (§7.1).»

### 2. Centro de alertas — LOG-01

- **Qué hago:** *Alertas* → filtro «Tipo de alerta: Vencimiento» → clic en la primera fila.
- **Qué se ve:**
  - píldoras **19 sin atender**, **5 rojas** y **11 amarillas**; con el filtro quedan **2** alertas AL04;
  - el panel muestra el medidor y «Lote LP-10063-270113 (40 u.) con **12 días** de vida ≤ 15: ya no se despacha.»
- **Qué digo:** «Hay 16 tipos de alerta (AL01–AL16, §7.2). Cada una tiene responsable, plazo y escalamiento; quien la atiende queda registrado (RNF07). Esta la resolvemos en la escena 7.»

### 3. Ficha del ART-10021 (Paceña 620 ml) — LOG-01

- **Qué hago:** *Artículos* → **ART-10021**, y bajo hasta *Parámetros* y *Capas FIFO*.
- **Qué se ve:**
  - La Paz: disponible **920**, reservado **160**;
  - tres capas de **360** cajas en PICK-A con costos **12.40 / 12.52 / 12.65**; la de 12.40 dice «Próxima en salir»; costo FIFO vigente **USD 12.40**;
  - fórmulas con los números del backend: **SS = 2.05 × 17 × √3 = 60** y **ROP = d × L + SS = 120 × 3 + 60 = 420**; Máx **1,260**.
- **Qué digo:** «Cada entrada es una capa con lote, costo y vencimiento (§6.1). El ROP sale de la demanda, el lead time y el stock de seguridad (§4.1); es el ejemplo del documento (§4.2).»

### 4. Pedido de 600 y despacho FIFO — LOG-01

- **Qué hago:** *Operaciones* → *Pedidos* (CD-LP-01). Elijo ART-10021, cantidad **600** → «Crear pedido y reservar». Luego, en la fila del pedido, «Despachar».
- **Qué se ve:**
  - al reservar nace **AL01** para ART-10021: la posición cae a 920 − 600 = 320 ≤ ROP 420;
  - al despachar, las capas consumidas son **360 × 12.40 = USD 4,464.00** y **240 × 12.52 = USD 3,004.80**; costo total **USD 7,468.80**.
- **Qué digo:** «El pedido reserva en la misma transacción (P05). La salida agota la capa más antigua y toma 240 de la siguiente: es FIFO, no un promedio.»

### 5. Reposición completa con diferencia y aprobación — LOG-01, ALM-SC, ALM-LP

1. **LOG-01**:
   - *Operaciones* → *Traslados* (CD-LP-01) → en *Propuestas*, ART-10035 (AL01 roja, propuesta 453) → «Crear traslado»;
   - cantidad **100** → la vista previa dice cómo cambia la posición → «Emitir traslado» (se emite **OT-2027-000X**).
2. **ALM-SC**: *Traslados* → «Despachar desde CD-SC-01». La mercadería pasa al **tránsito** con su costo FIFO.
3. **ALM-LP**:
   - «Recibir en CD-LP-01» → recibido **95** → aviso «Diferencia de 5» → «Confirmar recepción»;
   - nace **AL09**.
4. **LOG-01**: *Aprobaciones* → bandeja de diferencias → el ajuste del traslado → «Aprobar». El tránsito vuelve a **0**.

- **Qué digo:** «Origen, tránsito y destino (§6, P04): la entrada solo se da con la recepción confirmada. La diferencia la aprueba otro rol: control interno (§11).»

### 6. Conteo ciego y ajuste — ALM-LP, luego LOG-01

- **Qué hago:**
  - **ALM-LP**: *Operaciones* → *Conteo* (ART-10021). No se muestra el saldo del sistema. Escribo **474** → «Registrar conteo»;
  - el enlace al ajuste lleva a «Tu rol no tiene acceso»;
  - cambio a **LOG-01** → abro el ajuste → «Aprobar».
- **Qué se ve:**
  - «Conteo registrado con diferencia»: el sistema tenía **480** (1,080 − 600 despachadas);
  - el ajuste consume **6 × 12.52** con FIFO.
- **Qué digo:** «Quien cuenta no aprueba (P07). El ajuste es un movimiento nuevo: nada se borra, y un trigger de PostgreSQL lo impide (RNF07).»

### 7. Vencimientos y cuarentena — ALM-LP

- **Qué hago:** *Operaciones* → *Cuarentena* → capa **LP-10063-270113** (ART-10063, 40 u., 12 días de vida) → cantidad **40** → «Mover a CUAR-01».
- **Qué se ve:** la capa aparece en *Capas en cuarentena*; ya no cuenta como vendible. Solo LOG-01 puede liberarla.
- **Qué digo:** «No se despacha con menos de 15 días de vida (P10); AL04 avisa a los 30 y a los 15 días (§6.3).»

### 8. Fiestas — LOG-01

- **Qué hago:**
  - *Fiestas* → «Aniversario de La Paz y Día de la Patria» (16/07–06/08, f = 1.3, faltan **16** días);
  - bajo a «Preparación en La Paz» → «Crear traslados extraordinarios» → ART-10048 con **91** → «Emitir».
- **Qué se ve:**
  - cronograma con «3 semanas antes» **en curso** (revisar vencimientos, 25/06–01/07);
  - **AL14** amarilla en ART-10035 y ART-10048;
  - en La Paz, ART-10048 en **Crítico** con brecha **91** (pronóstico 91, posición 0);
  - fórmula: **ROP fiesta = 45 × 1.3 × 3 + 23 × 1.3 = 205** (ART-10035).
- **Qué digo:** «Cada fiesta sube el ROP con su factor estacional y se prepara de 3 a 8 semanas antes (§8.2, P11). El traslado extraordinario cubre la brecha.»

### 9. Análisis y costos — LOG-01

- **Qué hago:** *Análisis* (tabla ABC y Pareto) → *Costos* con «Todos» y junio 2027.
- **Qué se ve:**
  - **ART-10021, 10022 y 10035** son clase A; el tercero llega a **74.69%** acumulado;
  - ART-10021 en junio: **8,615 cajas** y **USD 106,421.87** de adquisición (8,015 cajas y USD 98,953.07 antes del despacho de la escena 4: suman exactamente los USD 7,468.80);
  - la nota compara con el ejemplo del documento (7,920 × 12.40 = USD 98,208, §5).
- **Qué digo:** «Pocos artículos concentran el valor (ABC, §4.3). Los cuatro costos —conservación, pedido, agotamiento y adquisición— salen de los movimientos (§5). El historial simula 24 días de despacho en junio, como el documento.»

### 10. Administración — TI-01

- **Qué hago:**
  - *Administración* → «Verificar integridad»;
  - «Restablecer datos» → escribo **RESTABLECER** → confirmar.
- **Qué se ve:**
  - **6 comprobaciones en ✔** (Σ capas = Σ movimientos, sin saldos negativos, trigger activo…);
  - tras restablecer: «30/06/2027, 19 alertas vigentes»; las otras pestañas muestran «Restableciendo…» y reintentan solas.
- **Qué digo:** «El inventario siempre cuadra: stock, costo y movimientos (RNF06). Y la demo vuelve al estado inicial en segundos.»

## Plan B

| Problema | Qué hago |
|----------|----------|
| Algo quedó a medias o los números no coinciden | Pestaña de TI-01 → *Administración* → «Restablecer datos» (≈ 5 s) y retomo la escena. |
| La página no carga o dice «No se pudo conectar» | En la terminal: `npm run demo:detener` y `npm run demo:iniciar` (≈ 1 min). Mientras tanto, muestro las capturas de `docs/capturas/recorrido/`. |
| Docker no abre | Presento con las capturas de `docs/capturas/recorrido/` (una por escena, en orden). |
| Se acaba el tiempo | Salto de la escena 6 a la 8 y cierro con la 10. |
| Un botón no aparece | Reviso el usuario: cada rol ve solo lo suyo (por ejemplo, ALM-LP no aprueba). |

## Preguntas probables

**¿Por qué FIFO y no LIFO?**
LIFO está prohibido bajo IFRS/NIIF, y el promedio ponderado no sigue la rotación física de la mercadería. Con FIFO, el costo sale en el mismo orden en que sale el producto, que además vence. En el ejemplo del documento la salida cuesta $5,050 con FIFO, $5,150 con LIFO y $5,107.14 con el promedio. §6.1 y P03.

**¿Por qué un sistema perpetuo?**
El preventista necesita ver el stock real y reservarlo al confirmar cada pedido (unos 2,100 al día). Un sistema periódico solo conoce el stock después de un conteo. Los conteos cíclicos verifican el perpetuo. §1, §6.2 y P02.

**¿Cómo se calcula el stock de seguridad?**
SS = Z × σd × √L. Z depende del nivel de servicio de la clase ABC: A 98% (Z = 2.05), B 95% y C 90%. Para el ART-10021 en La Paz: 2.05 × 17 × √3 = 60. §4.1 y §4.3.

**¿Qué pasa si dos preventistas piden la última caja al mismo tiempo?**
El pedido reserva dentro de una transacción con un candado por artículo y almacén (SELECT … FOR UPDATE). El segundo pedido espera al primero y lee el saldo ya descontado: si no alcanza, ve el faltante y el pedido queda pendiente de revisión. Nunca se vende stock que no existe. §9 («Vender stock que no existe») y P05.

**¿Cómo se distingue un robo de un error?**
Todo ajuste lleva motivo (pérdida o robo, error de registro, rotura, etc.), usuario, almacén y ubicación. Quien cuenta no aprueba, y los movimientos no se borran. El Pareto de ajustes por motivo (Análisis) muestra los patrones. AL06 en rojo, o pérdidas repetidas en una ubicación, disparan la investigación. §9, §10 (RI2, RI4) y P07–P08.

**¿Qué está simulado?**
- El reloj: una fecha simulada que avanza por días.
- Los usuarios: no hay contraseñas; se elige el rol con el selector, y el backend igual valida los permisos.
- La integración con Business Central y M1: eventos simulados para AL16.
- Hay un solo coordinador R07.
- Cada orden de traslado lleva un artículo.
- El historial de 90 días de despacho es sintético, pero determinista.

Todo lo demás se calcula de verdad en PostgreSQL: FIFO, ROP, alertas y costos. §15 y `docs/TRAZABILIDAD.md`.
