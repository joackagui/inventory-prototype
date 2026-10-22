# 05 · Fórmulas y reposición por dentro

**Qué vas a aprender**
- Las fórmulas de SS, ROP, Q y Máx en `backend/src/inventario/calculos/formulas.ts`.
- ABC, ROP de fiesta, traslado propuesto y cobertura, cada uno calculado a mano y comparado con el sistema.
- Cómo correr los tests que las comprueban.

## Un solo camino: `calcularParametros()`

```ts
export function calcularParametros(d, sigma, leadTimeDias, clase, nivelServicio = NIVEL_SERVICIO[clase].nivelServicio) {
  const z = zDesdeNivelServicio(nivelServicio);           // 98% → 2.05, 95% → 1.65, 90% → 1.28
  const diasRevision = DIAS_REVISION[clase];              // A y B: 7 días; C: 14
  const stockSeguridad = calcularSS(z, sigma, leadTimeDias); // Math.round(z × σ × √L)
  const rop = calcularROP(d, leadTimeDias, stockSeguridad);  // d × L + SS
  const loteTraslado = calcularQ(d, diasRevision);           // d × días de revisión
  return { nivelServicio, z, diasRevision, stockSeguridad, rop, loteTraslado, stockMaximo: calcularMaximo(rop, loteTraslado) };
}
```

- Las cuatro funciones internas (`calcularSS`, `calcularROP`, `calcularQ`, `calcularMaximo`) son privadas al archivo: el resto del sistema **solo** puede pasar por `calcularParametros()`. Así nadie duplica una fórmula con otro redondeo.
- El redondeo del SS es siempre `Math.round` (al entero más cercano).
- Si el nivel de servicio no es uno de los tres tabulados (por ejemplo 97%), `zDesdeNivelServicio()` calcula Z con una aproximación de la normal inversa.

## Comprobaciones a mano

| Cálculo | A mano | Sistema | ✔ |
|---------|--------|---------|---|
| SS ART-10021 La Paz | 2.05 × 17 × √3 = 2.05 × 17 × 1.732 = 60.36 → **60** | `stockSeguridad: 60` | ✔ |
| ROP | 120 × 3 + 60 = **420** | `rop: 420` | ✔ |
| Q (clase A, 7 días) | 120 × 7 = **840** | `loteTraslado: 840` | ✔ |
| Máx | 420 + 840 = **1,260** | `stockMaximo: 1260` | ✔ |
| SS ART-10035 La Paz | 2.05 × 6.5 × √3 = 23.08 → **23**; ROP 45 × 3 + 23 = **158**; Máx 158 + 315 = **473** | 23 / 158 / 473 | ✔ |
| Simular d = 150 (ART-10021) | ROP 150 × 3 + 60 = **510**; Q 1,050; Máx **1,560** | `simulado.rop: 510`, `stockMaximo: 1560` | ✔ |

Los valores del sistema salen de `GET /api/articulos/ART-10021/resumen?almacenId=CD-LP-01` y de `POST /api/parametros/ART-10021/CD-LP-01/simular`.

## Traslado propuesto y cobertura

```ts
export const trasladoPropuesto = (maximo, posicion, rop) => posicion <= rop ? maximo - posicion : 0;
export const cobertura = (disponible, d) => d > 0 ? Math.round((disponible / d) * 10) / 10 : 0;
```

| Caso | A mano | Sistema |
|------|--------|---------|
| ART-10021 después de reservar 600 | posición 320 ≤ 420 → 1,260 − 320 = **940** | AL01: «Traslado propuesto: 940» |
| ART-10035 La Paz (base) | posición 20 ≤ 158 → 473 − 20 = **453** | AL01: «Traslado propuesto: 453» |
| Cobertura ART-10021 La Paz | 920 ÷ 120 = 7.67 → **7.7 días** | `coberturaDias: 7.7` |

**Origen sugerido:** `GET /api/traslados/propuesta` elige el almacén con más **excedente sobre su propio ROP**. Para el ART-10021 sugiere CD-SC-01 (950 − 450 = 500 de excedente) antes que CD-CB-01 (640 − 380 = 260). Así nunca se repone un almacén dejando al otro bajo su ROP.

## Clase ABC

`clasificarAbc()` ordena por venta diaria = precio × d y acumula porcentajes. El primer artículo siempre es A:

| Artículo | Precio × d | Venta diaria | % | Acumulado | Clase |
|----------|-----------|--------------|---|-----------|-------|
| ART-10021 | 18.70 × 120 | 2,244 | 35.36% | 35.36% | A |
| ART-10022 | 21.90 × 70 | 1,533 | 24.16% | 59.52% | A |
| ART-10035 | 21.40 × 45 | 963 | 15.17% | **74.69%** | A |
| ART-10048 | 18.20 × 35 | 637 | | 84.73% | B |

El sistema da exactamente esos valores (`GET /api/abc`). La clase decide Z (servicio), los días de revisión (Q) y la frecuencia del conteo (30, 90 o 180 días).

## ROP de fiesta

```ts
export const ropFiesta = (d, f, leadTimeDias, ss) => Math.round(d * f * leadTimeDias + ss * f);
export const qFiesta = (d, f, diasRevision = 7) => Math.round(d * f * diasRevision);
export const pronosticoFiesta = (d, f, diasFiesta) => Math.round(d * f * diasFiesta);
```

| Caso | A mano | Sistema (`GET /api/fiestas/preparacion`) |
|------|--------|------------------------------------------|
| ART-10035, aniversario de La Paz (f = 1.3) | 45 × 1.3 × 3 + 23 × 1.3 = 175.5 + 29.9 = **205** | `ropFiesta: 205` |
| Q de fiesta | 45 × 1.3 × 7 = 409.5 → **410** | `qFiesta: 410` |
| Pronóstico (2 días) | 45 × 1.3 × 2 = **117**; brecha 117 − 20 = **97** | `pronostico: 117`, `brecha: 97` |
| ART-10021, Navidad (f = 1.7) | 120 × 1.7 × 3 + 60 × 1.7 = 612 + 102 = **714** | `ropFiesta: 714` (el ejemplo del documento, §8.2) |

## Costo de conservación

```ts
export const costoConservacion = (valorStockPromedio, tasaAnual) => Math.round(((valorStockPromedio * tasaAnual) / 12) * 100) / 100;
```

ART-10021 en La Paz, junio: 11,432.66 × 0.15 ÷ 12 = **142.91**. Coincide con la pantalla Costos.

## Correr los tests de las fórmulas

```bash
npm --prefix backend test -- src/inventario/calculos
```

- `npm --prefix backend` ejecuta el script `test` del paquete `backend/` sin cambiar de carpeta.
- `--` pasa lo que sigue a Vitest, que filtra solo los archivos de esa carpeta.
- Resultado real: `Tests 10 passed (10)`.

Para ver el archivo de pruebas: `backend/src/inventario/calculos/formulas.spec.ts`. Todos los tests unitarios del backend: `npm --prefix backend test` (34).

## Ideas para recordar
- SS = Z × σd × √L (redondeado), ROP = d × L + SS, Q = d × días de revisión, Máx = ROP + Q.
- Todo pasa por `calcularParametros()`: un solo lugar, un solo redondeo.
- El traslado se propone solo si la posición ≤ ROP, y llena hasta el Máx.
- La fiesta multiplica la demanda y el SS por el factor *f*.
- Cada número de esta página se comprobó a mano y contra la API.

---
Anterior: [← 04 · FIFO por dentro](04-fifo.md) · [Índice](README.md) · Siguiente: [06 · Motor de alertas →](06-alertas.md)
