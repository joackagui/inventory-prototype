# Especificación del prototipo de inventario CBN

Prototipo funcional (demo en vivo, en localhost) del **sistema de inventarios del ERP de CBN** (AB InBev Bolivia, canal de preventa). No es el ERP completo: solo el inventario (módulo M3 y sus maestros MD2 y MD4). Todo en español. Los datos son de muestra y están hard-codeados en un seed, pero el sistema usa una base de datos real y calcula todo (no hay números pegados en pantalla).

Fuente completa: los documentos de la carpeta `2nd evaluation` (Sistema de Inventarios del ERP CBN.docx es el principal). Esta especificación resume lo necesario; si hay duda, manda el documento.

## 1. Alcance

CBN trabaja con **inventario de tipo mercadería, con algoritmo FIFO y sistema perpetuo**.

- Mercadería terminada (cerveza, gaseosas, aguas) en 3 almacenes. Sin producción, sin compras, sin MRP.
- **Sistema perpetuo:** cada movimiento actualiza stock y costo en el momento, dentro de una transacción.
- **FIFO por capas:** cada entrada crea una capa (cantidad, costo, lote, vencimiento). Cada salida consume primero la capa más antigua y toma su costo. Los movimientos no se borran ni se editan.
- **Reposición = traslado entre plantas**, no compra.
- Fuera del alcance: pedidos, facturación, crédito, clientes, rutas, precios. Solo hay un "pedido simulado" que reserva stock (para demostrar la reserva).

## 2. Reloj simulado

La app tiene una **fecha de operación simulada**, por defecto **30/06/2027**. Un control en la barra superior permite avanzar o retroceder días (para demostrar vencimientos, conteos atrasados y fiestas). Todas las alertas se calculan con esa fecha, no con la fecha real.

## 3. Almacenes (MD4)

| Código | Nombre | Lead time L (días) | Tránsito |
|---|---|---|---|
| CD-LP-01 | Planta y CD La Paz | 3 | TR-LP |
| CD-CB-01 | Planta y CD Cochabamba | 4 | TR-CB |
| CD-SC-01 | Planta y CD Santa Cruz | 3 | TR-SC |

Ubicaciones por almacén: `PICK-A` (cerveza retornable), `PICK-B` (latas, gaseosas y aguas), `ENV-RET` (envases devueltos), `MUELLE-01` (carga), `CUAR-01` (cuarentena: vencido, dañado o en revisión; no se vende). El almacén de tránsito (TR-xx) no se vende. Todo movimiento indica almacén y ubicación.

## 4. Artículos (MD2) — 7 de referencia, demanda de La Paz

Precio en USD por caja o pack. d = demanda diaria en La Paz (cajas o packs por día), σd = desviación estándar diaria.

| Código | Descripción | Precio | d (LP) | σd (LP) | Clase ABC | Vida útil (días) | Costo FIFO inicial |
|---|---|---|---|---|---|---|---|
| ART-10021 | Paceña 620 ml retornable · caja x12 | 18.70 | 120 | 17 | A | 180 | 12.40 |
| ART-10022 | Paceña lata 354 ml · caja x24 | 21.90 | 70 | 10 | A | 270 | 14.50 |
| ART-10035 | Huari 620 ml retornable · caja x12 | 21.40 | 45 | 6.5 | A | 180 | 14.10 |
| ART-10048 | Taquiña 620 ml retornable · caja x12 | 18.20 | 35 | 5 | B | 180 | 12.10 |
| ART-20011 | Pepsi 2 L · pack x6 | 7.80 | 60 | 8.5 | B | 120 | 5.20 |
| ART-10063 | Bock 620 ml retornable · caja x12 | 19.30 | 20 | 3 | C | 180 | 12.80 |
| ART-30005 | Agua Vital 2 L · pack x6 | 4.60 | 25 | 4 | C | 365 | 3.10 |

La clase ABC **se calcula** (no solo se guarda): venta diaria en dólares = precio × d, orden descendente, corte en 80% acumulado (A), 95% (B) y resto (C). Con estos datos da A: 10021, 10022, 10035; B: 10048, 20011; C: 10063, 30005. Debe haber una pantalla de análisis ABC/Pareto.

Por artículo y almacén se guardan: d, σd, L, clase, Z, SS, ROP, Q, Máx, costo y último conteo.

- Demanda por almacén respecto de La Paz: Cochabamba = 0.67 × d(LP) y σ = 0.86 × σ(LP); Santa Cruz = 1.08 × d(LP) y σ igual a La Paz. Redondea d a entero.
- Nivel de servicio y Z: clase A 98% (Z 2.05), B 95% (Z 1.65), C 90% (Z 1.28).

## 5. Fórmulas (todas se calculan en el backend)

- **SS = Z × σd × √L** (redondear hacia arriba o al entero más cercano, pero un mismo criterio siempre; con los datos de La Paz da 60, 36, 23, 14, 24, 7 y 9).
- **ROP = d × L + SS**
- **Q = d × días de revisión** (7 días para clases A y B, 14 para C)
- **Máx = ROP + Q**
- **Posición = disponible + en tránsito**. **Traslado propuesto = Máx − posición**, cuando la posición ≤ ROP.
- **Cobertura (días) = disponible ÷ d**
- **Stock de ciclo, seguridad, tránsito y estacional:** mostrar en la ficha del artículo.
- Valores esperados de ART-10021: LP ROP 420 / Q 840 / Máx 1,260; CB ROP 380 / Q 560 / Máx 940; SC ROP 450 / Q 910 / Máx 1,360.

## 6. Estados del stock

Por artículo y almacén: **disponible** (vendible), **reservado** (comprometido con un pedido confirmado; no se vende), **en tránsito** (en transferencia; no se vende), **envase entregado** (cajas y botellas en poder del cliente; control por cantidad, sin FIFO). Stock total = disponible + reservado en el almacén (el tránsito está en el almacén de tránsito).

## 7. Movimientos

Todos transaccionales, con usuario, fecha de operación simulada, motivo, almacén y ubicación. No se borran ni se editan.

1. **Entrada / recepción:** crea capa FIFO con costo, lote y fecha de vencimiento (= elaboración + vida útil). Por producción de planta o por recepción de un traslado. Si la cantidad recibida difiere de la despachada, se registra la diferencia antes de dar entrada.
2. **Reserva:** el pedido simulado reserva stock al confirmar. Solo se vende disponible.
3. **Despacho (salida):** consume capas FIFO (la más antigua primero), no despacha con menos de 15 días de vida restante, valora la salida con el costo FIFO.
4. **Traslado entre plantas:** orden de transferencia (origen → tránsito → destino). El destino solo da entrada con la recepción confirmada.
5. **Conteo físico (cíclico y general):** compara contado vs. sistema; la diferencia genera un ajuste pendiente de aprobación.
6. **Ajuste y merma:** motivos: rotura, vencimiento, diferencia de conteo, pérdida o robo, error de registro, promoción. R06 registra y R07 aprueba (quien registra no aprueba).
7. **Cuarentena:** pasar capa a `CUAR-01` (vencido o dañado). No se vende.
8. **Envases retornables:** entrega y devolución por cliente (cantidades).
9. **Bonificación en especie (promoción):** salida sin cargo, con costo FIFO y motivo "promoción".

Conteo cíclico: clase A cada mes (30 días), B cada trimestre (90), C cada semestre (180); conteo general una vez al año. Tolerancia de diferencia: 0.5% del saldo.

## 8. Alertas (semáforo)

Colores: verde = normal, amarillo = atención (24 h), rojo = crítico (mismo turno; si no se atiende en 24 h sube de nivel), azul = informativo. Cada alerta guarda estado (abierta, atendida), quién la atendió, cuándo y resultado. Se evalúan al registrar un movimiento y al cambiar la fecha simulada.

| Cód. | Alerta | Amarillo | Rojo |
|---|---|---|---|
| AL01 | Reposición (posición vs ROP) | ≤ ROP | ≤ SS |
| AL02 | Quiebre | — | disponible = 0 |
| AL03 | Exceso | > Máx (azul) | > 2 × Máx |
| AL04 | Vencimiento próximo (vida restante de la capa más antigua) | ≤ 30 días | ≤ 15 días |
| AL05 | Conteo cíclico atrasado | > frecuencia (A 30, B 90, C 180 días) | > frecuencia + 7 días |
| AL06 | Diferencia de conteo (abs(contado − sistema) ÷ sistema) | > 0.5% | > 2% |
| AL07 | Ajuste o merma pendiente de aprobación | > 24 h | > 48 h |
| AL08 | Traslado sin recepción | > L + 1 día | > L + 2 días |
| AL09 | Diferencia en recepción | hasta 1% | > 1% o producto dañado |
| AL10 | Envases sin devolver (antigüedad) | > 30 días | > 60 días |
| AL11 | Pedido pendiente de revisión por falta de stock | > 2 h | > 1 día |
| AL12 | Reserva sin despacho | > 24 h | > 48 h |
| AL13 | Costo FIFO atípico (vs. capa anterior) | variación > 10% | > 15% |
| AL14 | Fiesta próxima con cobertura baja | faltan ≤ 21 días y no alcanza | faltan ≤ 7 días y no alcanza |
| AL15 | Promoción con stock insuficiente | cobertura < días restantes | disponible = 0 |
| AL16 | Falla de integración / conciliación (simulada con un botón) | evento en reintento | evento en cola de errores |

AL11 y AL16 pueden ser simulados (botón de demo que los dispara).

## 9. Fiestas y promociones

Factor estacional f multiplica d durante la fiesta. ROP de fiesta = d × f × L + SS × f; Q de fiesta = d × f × 7; Máx = ROP + Q. Pronóstico de fiesta = d × f × días de la fiesta. AL14 compara posición vs. pronóstico.

| Fiesta | Fecha 2027 | Zona | f | Preparación (semanas antes) |
|---|---|---|---|---|
| Año Nuevo | 31/12 y 01/01 | Todas | 1.7 | 8 |
| Carnaval | 06 al 09/02 | Todas | 1.6 | 6 |
| Día del Padre | 19/03 | Todas | 1.2 | 3 |
| Gran Poder | 22/05 | La Paz | 1.5 | 6 |
| Día de la Madre | 27/05 | Todas | 1.2 | 3 |
| Año Nuevo Andino y San Juan | 21 al 24/06 | La Paz y Cochabamba | 1.3 | 4 |
| Aniversario de La Paz y Día de la Patria | 16/07 y 06/08 | La Paz y todas | 1.3 | 4 |
| Urkupiña | 14 al 16/08 | Cochabamba | 1.6 | 6 |
| Aniversarios de Cochabamba y Santa Cruz | 14/09 y 24/09 | Cochabamba y Santa Cruz | 1.3 | 4 |
| Navidad | 24 y 25/12 | Todas | 1.7 | 8 |

Ejemplo: ART-10021 en La Paz para Navidad: ROP 714, Q 1,428, Máx 2,142.
Promociones (solo como datos y ejemplo de bonificación): descuento festivo, bonificación en especie, liquidación por vencimiento (lotes con 15 a 30 días), rotación de exceso. Las promociones tienen vigencia y tope en cajas; la bonificación sale del stock con costo FIFO.

## 10. Costos

Conservación = valor del stock promedio × 15% anual (mensual ÷ 12). Pedido = costo por traslado (parámetro, por ejemplo USD 180 por traslado). Agotamiento = ventas no atendidas (1.5% de los pedidos, unos USD 9,072 al mes). Adquisición = costo FIFO de las capas. Mostrar un panel de costos por artículo/almacén. Ejemplo ART-10021 en junio: costo de lo vendido 7,920 cajas × 12.40 = USD 98,208; stock promedio 1,335 cajas = USD 16,554; conservación mensual USD 207.

## 11. Usuarios y roles (genéricos, sin login real)

Un selector de usuario en la barra superior cambia el rol activo (no hace falta contraseña, pero el backend debe validar permisos por rol).

| Usuario | Rol | Qué puede hacer |
|---|---|---|
| PV-014 | R01 Preventista | Ver si un artículo está disponible o agotado; crear pedido simulado (reserva). No ve costos ni alertas. |
| SUP-01 | R02 Supervisor de ventas | Proponer promociones, ver envases sin devolver. Consulta. |
| ALM-LP, ALM-CB, ALM-SC | R06 Almacén | Solo opera su almacén: recibe, despacha, cuenta, registra mermas y ajustes (no los aprueba), recibe traslados. |
| LOG-01 | R07 Coordinador de logística | Los 3 almacenes. Fija parámetros (d, σd, L, ROP, clase), aprueba traslados, ajustes y mermas, prepara fiestas, ajusta umbrales. |
| GER-01 | R08 Gerencia | Solo consulta el tablero y los costos. |
| TI-01 | R09 Administrador | Ver usuarios, el registro de cambios y reprocesar eventos (AL16). |

## 12. Escenario de demo (fecha simulada 30/06/2027)

Almacén La Paz (el tablero debe mostrar exactamente esto al arrancar):

| Artículo | Disponible | En tránsito | ROP | SS | Máx | Vida restante (días) | Estado esperado |
|---|---|---|---|---|---|---|---|
| ART-10021 | 920 | 0 | 420 | 60 | 1,260 | 137 | Normal |
| ART-10022 | 240 | 0 | 246 | 36 | 736 | 214 | AL01 amarillo (traslado propuesto 496) |
| ART-10035 | 20 | 0 | 158 | 23 | 473 | 96 | AL01 rojo (disponible ≤ SS) |
| ART-10048 | 0 | 0 | 119 | 14 | 364 | — | AL02 quiebre |
| ART-20011 | 700 | 0 | 204 | 24 | 624 | 58 | AL03 exceso (azul) |
| ART-10063 | 150 | 0 | 67 | 7 | 347 | 12 | AL04 rojo (vence en 12 días) |
| ART-30005 | 210 | 0 | 84 | 9 | 434 | 301 | AL05 amarillo (último conteo hace 185 días) |

Reservado del ART-10021 en La Paz: 160 (stock total 1,080). Cochabamba: ART-10021 disponible 640, reservado 120. Santa Cruz: ART-10021 disponible 950, reservado 140. Para los demás artículos de Cochabamba y Santa Cruz, elige disponibles que den una mezcla de estados (algunos normales, uno en AL01, uno en AL03, uno con traslado en tránsito atrasado AL08) y documéntalos en el seed.

Además, el seed debe incluir: capas FIFO con lote y vencimiento coherentes con las vidas restantes (el ART-10021 puede tener 2 o 3 capas; el costo FIFO de la capa más antigua es 12.40); historial de movimientos de los últimos 90 días hábiles por artículo y almacén (para calcular d y σd de verdad, o para mostrar kardex); 1 traslado en tránsito; 2 ajustes pendientes de aprobación (uno de más de 24 h); envases entregados a 4 clientes genéricos ("Cliente 001" etc.), uno con más de 60 días; 1 promoción de liquidación por vencimiento sobre el ART-10063.

## 13. Pantallas del prototipo (no es el diseño de los mockups del ERP)

1. **Tablero**: semáforo por almacén y artículo, contadores de alertas por color, cobertura, valor del inventario, selector de almacén.
2. **Centro de alertas**: lista filtrable por tipo, color, almacén; atender una alerta con comentario.
3. **Artículo**: ficha con parámetros (d, σd, L, Z, SS, ROP, Q, Máx), estados de stock, capas FIFO con lote y vencimiento, kardex valorado, gráfico de movimiento.
4. **Operaciones**: recepción, despacho/pedido simulado, traslado, conteo, ajuste y merma, cuarentena, envases. Cada una valida reglas.
5. **Aprobaciones** (R07): ajustes, mermas y traslados pendientes.
6. **Análisis ABC / Pareto** y ranking de ajustes por motivo.
7. **Fiestas**: calendario, factor, ROP de fiesta, pronóstico y estado de preparación.
8. **Costos**: conservación, pedido, agotamiento y adquisición.
9. **Administración (demo)**: fecha simulada, cambio de usuario, restablecer datos (re-seed), botón para simular AL11/AL16.

Frontend fuerte: moderno, limpio, responsive, con gráficos y semáforo claro; pensado para proyectarse en vivo.
