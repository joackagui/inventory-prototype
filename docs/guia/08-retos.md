# 08 · Experimentos y retos (aprender haciendo)

**Qué vas a aprender**
- A cambiar el sistema y predecir el resultado antes de verlo.
- A usar ramas de Git para experimentar sin miedo.
- Dónde tocar el código para cada tipo de cambio.

## Cómo experimentar sin romper nada

Cada reto va en su propia rama:

```bash
git checkout main                     # parte siempre de la versión buena
git checkout -b reto/01-demanda       # crea la rama del reto y entra en ella
# … haces el reto …
git checkout -- .                     # descarta TODOS los cambios de archivos que no confirmaste
git checkout main                     # vuelve a main
git branch -D reto/01-demanda         # borra la rama del experimento
```

| Comando | Qué hace |
|---------|----------|
| `git checkout -b <rama>` | Crea una rama nueva desde donde estás y se cambia a ella |
| `git checkout -- .` | Deshace los cambios **no confirmados** en todos los archivos (no se puede recuperar) |
| `git branch -D <rama>` | Borra la rama aunque no esté unida a main |

Para los retos de datos (1 a 5), basta con **Restablecer datos** al terminar ([capítulo 00](00-como-usar.md)). Para los retos de código (6 a 10), usa el modo desarrollo (`npm run backend:dev` y `npm run frontend:dev`): los cambios se recargan solos.

Todos estos retos se probaron de verdad; el resultado esperado es el que salió.

---

## Reto 1 · Cambiar la demanda diaria y ver ROP y alertas (fácil, sin código)
- **Rama:** `git checkout -b reto/01-demanda`.
- **Pasos:**
  1. LOG-01 → ficha ART-10021 → «Editar parámetros de Planta y CD La Paz» → d = **400**.
  2. Mira la vista previa: ROP **1,260** (400 × 3 + 60).
  3. «Guardar cambios» → «Confirmar y guardar».
- **Qué debería pasar:**
  - ROP 1,260; Máx **4,060** (1,260 + 400 × 7);
  - nace **AL01** («Posición 920 ≤ ROP 1260. Traslado propuesto: 3140»);
  - también nace **AL14**: el pronóstico de la fiesta sube a 1,040, más que la posición de 920.
- **Deshacer:** Restablecer datos.

## Reto 2 · Editar el umbral de AL04 (fácil, sin código)
- **Rama:** `git checkout -b reto/02-umbral`.
- **Pasos:** *Alertas* → *Umbrales* → AL04 amarillo = **10** y guardar. Luego prueba **100**.
- **Qué debería pasar:**
  - con 10: error «el umbral amarillo (10) debe dispararse antes que el rojo (15)»;
  - con 100: se crean **7** alertas AL04 nuevas (por ejemplo, «Lote LP-10035-270407 (10 u.) con 96 días de vida ≤ 100»).
- **Por qué:** `validarUmbral()` exige que el amarillo avise antes. Al guardar se reevalúan todas las alertas.
- **Deshacer:** vuelve a 30 o Restablecer datos (el seed restaura los umbrales por defecto).

## Reto 3 · Intentar aprobar un ajuste propio (fácil)
- **Rama:** `git checkout -b reto/03-autoaprobacion`.
- **Pasos** (en la terminal, con el sistema encendido):
  ```bash
  curl -s -H 'X-Usuario: LOG-01' -H 'Content-Type: application/json' -X POST localhost:3000/api/ajustes \
    -d '{"almacen":"CD-LP-01","articulo":"ART-30005","cantidad":-1,"motivo":"ROTURA"}'
  # anota el "id" de la respuesta y úsalo aquí:
  curl -s -H 'X-Usuario: LOG-01' -H 'Content-Type: application/json' -X POST localhost:3000/api/ajustes/ID/aprobar -d '{}'
  ```
  `-H` agrega un encabezado, `-X POST` elige el método y `-d` es el cuerpo JSON.
- **Qué debería pasar:** **403** `{"codigo":"AUTOAPROBACION","mensaje":"Quien registra un ajuste o merma no puede aprobarlo ni rechazarlo"}`.
- **Lee el error en el código:** `backend/src/inventario/operaciones/ajustes.service.ts` (busca `AUTOAPROBACION`).
- **Deshacer:** Restablecer datos.

## Reto 4 · Provocar un 409 con dos pedidos simultáneos (media)
- **Rama:** `git checkout -b reto/04-concurrencia`.
- **Pasos:** el ART-10035 tiene vendible **20** en La Paz. Lanza dos pedidos de 20 **al mismo tiempo**:
  ```bash
  B='{"cliente":"Cliente 001","almacen":"CD-LP-01","lineas":[{"articulo":"ART-10035","cantidad":20}]}'
  for i in 1 2; do curl -s -o /dev/null -w "pedido $i: %{http_code}\n" -X POST \
    -H 'X-Usuario: PV-014' -H 'Content-Type: application/json' -d "$B" localhost:3000/api/pedidos & done; wait
  ```
  - `B='…'` guarda el cuerpo en una variable.
  - `-o /dev/null` descarta la respuesta y `-w` imprime solo el código HTTP.
  - `&` lanza cada `curl` en segundo plano y `wait` espera a los dos.
- **Qué debería pasar:** `201` y `409`, en cualquier orden.
- **Experimento extra (difícil):** en `backend/src/inventario/operaciones/pedidos.service.ts` comenta la línea `await bloquear(...)` dentro de `crear()` y repite el reto varias veces. Es posible que ambos reserven y que «Verificar integridad» marque el reservado > físico. Así se ve por qué existe el candado. **Deshacer:** `git checkout -- .` y Restablecer datos.

## Reto 5 · Crear una promoción y ver AL15 (media, sin código)
- **Rama:** `git checkout -b reto/05-promocion`.
- **Pasos:**
  1. **SUP-01:** *Operaciones* → *Promociones*: nombre «Promo Huari», tipo descuento festivo, ART-10035, CD-LP-01, del 30/06/2027 al 20/07/2027, tope 100, descuento 10% → «Proponer promoción».
  2. **LOG-01:** *Aprobaciones* → la promoción → referencia del correo «CORREO-GLV-2027-0500» → «Aprobar».
- **Qué debería pasar:** nace **AL15** amarilla: «Promoción Promo Huari: cobertura 0.4 días < 20 días restantes». Es decir, 20 vendibles ÷ 45 por día = 0.4 días, y a la promoción le quedan 20.
- **Deshacer:** Restablecer datos.

## Reto 6 · Agregar un artículo nuevo al seed (difícil)
- **Rama:** `git checkout -b reto/06-articulo`.
- **Archivo:** `backend/src/demo/sembrar.ts`.
- **Pasos:**
  1. En `ARTICULOS`, debajo del ART-30005, agrega:
     ```ts
     { codigo: 'ART-30010', descripcion: 'Agua Vital 600 ml · pack x12', familia: 'AGUA', unidad: 'pack x12', precio: 5.2, d: 30, sigma: 5, vida: 365, costo: 3.4, retornable: false },
     ```
  2. En `ESCENARIO`, agrega una línea en LP, CB y SC, por ejemplo `'ART-30010': { disponible: 150, esperado: 'Normal' },` (140 en CB y 160 en SC).
  3. Ejecuta `npm run db:seed` y luego `npm run db:verificar`.
- **Qué debería pasar:**
  - «Seed listo: **293 capas, 2680 movimientos**»;
  - la tabla muestra el ART-30010 en «Normal» y siguen las **19** alertas;
  - «Integridad OK: 293 capas, **25** combinaciones».
  - Ojo: los porcentajes del ABC cambian, porque hay más venta total.
- **Deshacer:** `git checkout -- .` y `npm run db:seed`.

## Reto 7 · Añadir una columna visible en una tabla (fácil)
- **Rama:** `git checkout -b reto/07-columna`.
- **Archivo:** `frontend/src/paginas/fiestas/Fiestas.tsx` (tabla «Preparación en …»).
- **Pasos:**
  1. En el arreglo de encabezados agrega `'f'` después de `'d'`.
  2. Corre los índices de alineación: `i < 8` → `i < 9` y `i === 8` → `i === 9`.
  3. Después de la celda `numero(x.demandaBase)`, agrega `<td className="num text-right">{x.factor}</td>`.
- **Qué debería pasar:** aparece la columna **f** con 1.3 en el aniversario de La Paz, y `npx tsc -b` (desde `frontend/`) no da errores. El dato ya venía en la API; el frontend solo lo muestra (regla: sin cálculos en el navegador).
- **Deshacer:** `git checkout -- .`.

## Reto 8 · Escribir un test nuevo de una fórmula (fácil)
- **Rama:** `git checkout -b reto/08-test`.
- **Archivo:** `backend/src/inventario/calculos/formulas.spec.ts`. Agrega al final:
  ```ts
  describe('reto: ROP de fiesta de Navidad', () => {
    it('ART-10021 en La Paz con f = 1.7 da 714 (documento §8.2)', () => {
      expect(ropFiesta(120, 1.7, 3, 60)).toBe(714);
    });
  });
  ```
- **Ejecuta:** `npm --prefix backend test -- src/inventario/calculos`.
- **Qué debería pasar:** `Tests 11 passed (11)`. Cambia 714 por 715 para ver cómo falla un test.
- **Deshacer:** `git checkout -- .` (o confírmalo: es un buen test).

## Reto 9 · Cambiar el color de una alerta (media)
- **Rama:** `git checkout -b reto/09-color`.
- **Archivo:** `backend/src/alertas/evaluadores.ts`, función `al03`. Cambia `res('AZUL', …)` por `res('AMARILLO', …)`.
- **Ejecuta:** `cd backend && npx vitest run src/alertas/evaluadores.spec.ts && cd ..`.
- **Qué debería pasar:** `1 failed | 19 passed`. Falla «AL03 exceso: > Máx azul, > 2 × Máx rojo»: los tests documentan la regla del documento. Si de verdad quisieras cambiarla, tendrías que actualizar también el test y [docs/ALERTAS.md](../ALERTAS.md). Con `backend:dev` corriendo, las 3 AL03 del tablero se vuelven amarillas.
- **Deshacer:** `git checkout -- .` y Restablecer datos.

## Reto 10 · Añadir un escenario de demo (media)
- **Rama:** `git checkout -b reto/10-escenario`.
- **Archivo:** `backend/src/demo/demo.dto.ts`, objeto `ESCENARIOS`. Agrega:
  ```ts
  'navidad-1-semana': { fecha: '2027-12-17', descripcion: 'Una semana antes de Navidad: AL14 en rojo.' },
  ```
- **Qué debería pasar:** en *Administración* (LOG-01) aparece el escenario. Al elegirlo, la fecha pasa a **17/12/2027** y las AL14 de Navidad se ponen en rojo (faltan 7 días). La pantalla lee la lista de `GET /api/simulacion/escenarios`, así que no hay que tocar el frontend.
- **Deshacer:** «Restablecer al 30/06/2027», `git checkout -- .`, y borra la rama.

## Ideas para recordar
- Una rama por experimento: `git checkout -b reto/...`; para deshacer, `git checkout -- .`.
- Predice el número antes de mirar la pantalla: así se aprende de verdad.
- Los tests son la documentación ejecutable de las reglas: si cambias una regla, falla un test.
- El frontend solo muestra lo que la API ya calcula.
- Restablecer datos siempre te devuelve al punto de partida.

---
Anterior: [← 07 · Datos, permisos y seguridad](07-datos-permisos.md) · [Índice](README.md) · Siguiente: [09 · Preparación para la defensa →](09-defensa.md)
