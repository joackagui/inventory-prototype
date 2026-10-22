# 09 · Preparación para la defensa

**Qué vas a aprender**
- Dónde se ve cada sección del documento «Sistema de Inventarios del ERP CBN» en el sistema.
- Respuestas cortas a 25 preguntas probables.
- A medirte con un autoexamen de 20 preguntas.
- Una chuleta de una página para el día de la presentación.

## Mapa documento ↔ sistema

| Sección del documento | Dónde se ve | Práctica |
|-----------------------|-------------|----------|
| §1 Perfil (preventa, 3 plantas) | Tablero con «Todos / LP / CB / SC» | 1 |
| §2 Base conceptual | Este capítulo y el [01](01-ideas-clave.md) | — |
| §3 Tipos y estados del stock | Ficha › Posición (disponible, reservado, tránsito, cuarentena) | 3 |
| §4.1–4.2 Parámetros y ejemplo ART-10021 | Ficha › Parámetros (SS 60, ROP 420, Máx 1,260) | 3 |
| §4.3 Clase ABC | Análisis › ABC (74.69%) | 14 |
| §5 Costos | Costos (adquisición, conservación, pedido, agotamiento) | 15 |
| §6.1 FIFO | Ficha › Capas FIFO; resultado del despacho | 5, 6 |
| §6.2 Perpetuo | Kardex; todo número se recalcula en cada operación | 5 |
| §6.3 Lotes y vencimientos | Vida restante, AL04, cuarentena | 6, 10 |
| §6.4 Conteo y ajustes | Operaciones › Conteo ciego; Aprobaciones | 8, 9 |
| §7 Alertas | Centro de alertas, semáforo, campana | 2, 12 |
| §8 Fiestas y promociones | Fiestas; Operaciones › Promociones; AL14, AL15 | 13 |
| §9 Prevención de pérdidas | Candados, trigger, segregación de funciones | 9, 16 |
| §10 Riesgos RI1–RI11 | [TRAZABILIDAD](../TRAZABILIDAD.md) | — |
| §11 Control interno | Roles y matriz de permisos | 9 |
| §13 Políticas P01–P12 | [TRAZABILIDAD](../TRAZABILIDAD.md) | — |

## 25 preguntas probables

1. **¿Por qué FIFO y no LIFO?** LIFO está prohibido por IFRS/NIIF. Además, la cerveza vence: FIFO hace que el costo siga a la caja que físicamente sale. Con el ejemplo del documento: FIFO $5,050, LIFO $5,150 (§6.1, P03).
2. **¿Y el costo promedio?** Da $5,107.14: suaviza el costo, pero no sigue la rotación física. Tampoco permite saber el costo de un lote concreto (por ejemplo, para darlo de baja).
3. **¿Perpetuo o periódico?** Perpetuo. El preventista debe ver el stock real y reservarlo al confirmar (unos 2,100 pedidos al día). El periódico solo sabe cuánto hay después de contar (§6.2, P02).
4. **¿Para qué contar si es perpetuo?** Porque el sistema puede equivocarse: roturas, robos, errores de registro. El conteo cíclico (A cada mes, B cada trimestre, C cada semestre) verifica el perpetuo (P07).
5. **¿Cómo se calcula el stock de seguridad?** SS = Z × σd × √L. Para el ART-10021 en La Paz: 2.05 × 17 × √3 = 60. Z sale del nivel de servicio de la clase (A 98%).
6. **¿Qué es el ROP y qué pasa al alcanzarlo?** d × L + SS = 420. Si la posición (disponible + tránsito) ≤ ROP, nace AL01 y se propone un traslado hasta el Máx.
7. **¿Por qué la posición incluye el tránsito?** Para no pedir dos veces lo mismo: lo que ya viene en camino cuenta.
8. **¿Qué pasa si dos preventistas piden la última caja a la vez?** La reserva corre dentro de una transacción con `SELECT … FOR UPDATE` sobre el par artículo/almacén. El segundo espera, lee el saldo actualizado y recibe un 409 con el faltante. Lo comprobamos: 201 y 409.
9. **¿Y si un pedido no alcanza?** Es todo o nada: no reserva nada, queda `PENDIENTE_REVISION` y, si nadie lo revisa en 2 h, aparece AL11.
10. **¿Cómo se evita el fraude?**
    - Movimientos inmutables (trigger en PostgreSQL).
    - Conteo ciego.
    - Quien registra no aprueba (`AUTOAPROBACION`).
    - Cada R06 opera solo su almacén.
    - Toda acción queda con usuario, fecha y motivo.
    - El Pareto de ajustes por motivo.
11. **¿Se puede borrar un movimiento equivocado?** No. Se corrige con un movimiento nuevo (un ajuste aprobado). Ni un UPDATE directo en la base funciona.
12. **¿Por qué la reposición es por traslado y no por compra?** Compras y producción están en AB InBev. CBN-preventa repone moviendo stock entre plantas: origen → tránsito → destino.
13. **¿Cómo se elige el almacén de origen?** El que tiene más excedente sobre su propio ROP. Para el ART-10021, SC (500) antes que CB (260), para no desabastecer al origen.
14. **¿Qué pasa si llega menos de lo enviado?** La recepción registra la diferencia, nace AL09 y queda un ajuste que aprueba R07. Lo que no llegó nunca entra al destino (P04).
15. **¿Cómo se tratan los vencimientos?** Cada capa tiene vencimiento. AL04 avisa a los 30 y a los 15 días. Con menos de 15 no se despacha (FIFO salta esa capa) y se pasa a cuarentena (P10).
16. **¿Cómo se preparan las fiestas?** Con un factor *f*: ROP de fiesta = d × f × L + SS × f (Navidad: 714). El cronograma empieza 3 a 8 semanas antes. AL14 avisa si la posición no cubre el pronóstico, y se emiten traslados extraordinarios (P11).
17. **¿Qué decide la clase ABC?** El nivel de servicio (Z), los días de revisión (Q) y la frecuencia del conteo. A = hasta 80% de la venta: tres artículos con 74.69%.
18. **¿Cuáles son los cuatro costos?**
    - Adquisición: FIFO de lo vendido.
    - Conservación: stock promedio × 15% anual.
    - Pedido: USD 180 por traslado.
    - Agotamiento: pedidos con faltante × margen.
19. **¿Cómo sabe que los datos están bien?** «Verificar integridad» corre 6 comprobaciones, entre ellas Σ capas = Σ movimientos, sin saldos negativos y trigger activo. Los tests terminan verificándola.
20. **¿Qué está simulado?**
    - La fecha (reloj por días).
    - Los usuarios (sin contraseñas, con el encabezado X-Usuario).
    - La integración con Business Central y M1 (eventos para AL16).
    - El historial de 90 días (sintético y determinista).
21. **¿Qué no está simulado?** Todo cálculo: FIFO, SS/ROP/Máx, alertas, costos y permisos. Corren de verdad en PostgreSQL y NestJS.
22. **¿Por qué una fecha simulada?** Para mostrar vencimientos, fiestas y escalamientos en minutos y obtener siempre los mismos resultados.
23. **¿Límites del prototipo?**
    - Un solo R07.
    - Traslados de un artículo por orden.
    - Las alertas «cada hora» se evalúan en cada operación o cambio de fecha.
    - Sin autenticación real.
    - Un solo puesto en la demo.
24. **¿Cómo escalaría a producción?**
    - Login real (OAuth/SSO) en lugar de X-Usuario.
    - Jobs programados para las alertas horarias y nocturnas.
    - Integración real con un patrón *outbox*.
    - Réplicas de lectura para los tableros.
    - Monitoreo y respaldos.
25. **¿Cómo lo probaron?** 34 tests unitarios, 65 de integración (base aparte), 40 de componentes, pruebas en el navegador con axe-core (accesibilidad) y un recorrido automático de las 10 escenas del guion: `npm run verificar`.

## Autoexamen (20 preguntas)

1. Entran 400 a $10 y 300 a $10.50; salen 500. Costo FIFO: a) $5,150 b) **$5,050** c) $5,107.14
2. Físico 1,080 y reservado 160. Disponible: a) 1,240 b) **920** c) 1,080
3. ROP con d = 120, L = 3, SS = 60: a) 360 b) 480 c) **420**
4. Q para un artículo clase C con d = 25: a) 175 b) **350** c) 25
5. ¿Qué archivo tiene las fórmulas puras? a) motor.ts b) **formulas.ts** c) evaluacion.ts
6. La AL01 roja significa: a) posición ≤ ROP b) **posición ≤ SS** c) vendible 0
7. Atender una alerta: a) la resuelve b) **registra quién y qué hizo, sin cerrarla** c) la borra
8. Una capa con 12 días de vida: a) sale primero b) **se salta en el despacho** c) se borra
9. Mover 15 de una capa de 40 a cuarentena: a) se pierde la capa b) **se divide en 25 + 15** c) error
10. ¿Qué impide UPDATE en `Movimiento`? a) Prisma b) el guard c) **un trigger de PostgreSQL**
11. Dos pedidos simultáneos por las últimas 20 cajas: a) ambos reservan b) **uno 201 y otro 409** c) ambos fallan
12. ALM-LP intenta aprobar un ajuste: a) lo aprueba b) **403 SIN_PERMISO** c) 409
13. LOG-01 aprueba un ajuste que él registró: a) lo aprueba b) **403 AUTOAPROBACION** c) 401
14. Clase A en ABC: a) **hasta 80% acumulado** b) hasta 95% c) el resto
15. ROP de fiesta del ART-10021 en Navidad (f = 1.7): a) 420 b) **714** c) 612
16. ¿Qué dispara una evaluación de todas las alertas? a) un GET b) **cambiar la fecha simulada** c) cambiar de usuario
17. Una alerta roja sin atender por más de 48 h: a) se resuelve b) **escala al nivel 2 (Gerente)** c) se vuelve amarilla
18. Conservación mensual con stock promedio USD 11,432.66 y 15% anual: a) $1,714.90 b) **$142.91** c) $171.49
19. ¿Dónde se valida el rol de cada petición? a) en React b) **UsuarioGuard** c) PostgreSQL
20. Restablecer datos deja: a) la base vacía b) **30/06/2027 con 19 alertas** c) la última fecha usada

**Explicaciones:**
1. 4,000 + 100 × 10.50.
2. 1,080 − 160.
3. 120 × 3 + 60.
4. La clase C revisa cada 14 días: 25 × 14.
5. Las fórmulas puras están en `formulas.ts`.
6. Rojo = la posición está bajo el colchón.
7. Atender registra quién y qué; resolver es automático.
8. El filtro `venceDesde` la deja fuera.
9. La gemela conserva lote y fecha.
10. El trigger `movimiento_inmutable`.
11. Por el candado de `bloquear()`.
12. Solo R07 aprueba.
13. Regla de no autoaprobación.
14. Corte en el 80%.
15. 612 + 102.
16. `EVENTO_EVALUAR`.
17. `nivelPorHorasEnRojo`.
18. 11,432.66 × 0.15 ÷ 12.
19. Guard global.
20. Vuelve a sembrar y verificar.

## Chuleta (una página)

| Fórmula | Ejemplo ART-10021 La Paz |
|---------|--------------------------|
| SS = Z × σd × √L | 2.05 × 17 × √3 = **60** |
| ROP = d × L + SS | 120 × 3 + 60 = **420** |
| Q = d × días de revisión (A/B 7, C 14) | 120 × 7 = **840** |
| Máx = ROP + Q | **1,260** |
| Traslado = Máx − posición (si posición ≤ ROP) | después de reservar 600: **940** |
| Cobertura = disponible ÷ d | 920 ÷ 120 = **7.7 días** |
| ROP fiesta = d × f × L + SS × f | Navidad: **714** · ART-10035 aniversario: **205** |
| Conservación = stock promedio × 15% ÷ 12 | **142.91** |

| Números del escenario (30/06/2027) | |
|------------------------------------|---|
| Alertas | **19** = 5 🔴 + 11 🟡 + 3 🔵; campana 5 |
| Valor del inventario | USD 78,535.66 |
| Capas / movimientos | 268 / 2,368 |
| ART-10021 LP | 3 capas × 360 a **12.40 / 12.52 / 12.65**; disponible 920, reservado 160 |
| Despacho de 600 | 360 × 12.40 + 240 × 12.52 = **USD 7,468.80** |
| ABC | ART-10021, 10022 y 10035 = A (74.69%) |
| Junio ART-10021 «Todos» | 8,015 cajas · USD 98,953.07 (8,615 después de la escena 4) |
| Regla de despacho | no con menos de **15 días** de vida |

| Usuario | Rol | Para la demo |
|---------|-----|--------------|
| PV-014 | R01 | pedidos, ve disponible o agotado |
| SUP-01 | R02 | propone promociones |
| AST-01 | R03 | atiende AL11 |
| ALM-LP / ALM-CB / ALM-SC | R06 | opera su almacén |
| **LOG-01** | R07 | aprueba, traslada, parámetros |
| GER-01 | R08 | solo lectura |
| TI-01 | R09 | integridad, restablecer |

## Rarezas conocidas del prototipo

Encontradas al verificar esta guía. No se corrigieron, porque esta tarea era solo de documentación:

1. **El escalamiento no retrocede con la fecha.** Al avanzar la fecha 5 días, 5 alertas rojas escalan. Al volver al 30/06/2027, el total vuelve a 19, pero `escaladas` queda en 5 (en el estado base es 0). Restablecer los datos sí lo deja en 0.

## Ideas para recordar
- Ten el mapa documento ↔ sistema a mano: cada pregunta teórica tiene una pantalla que la demuestra.
- Responde con un número real del escenario: es más convincente que la teoría sola.
- Sé honesto con lo simulado: reloj, usuarios, integración e historial. Los cálculos son reales.
- Repasa la chuleta 10 minutos antes de presentar.

---
Anterior: [← 08 · Experimentos y retos](08-retos.md) · [Índice](README.md) · Volver al [guion de la demo](../GUION_DEMO.md)
