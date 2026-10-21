// Evaluadores de alertas AL01–AL16 (sección 8 de docs/ESPECIFICACION.md). Funciones puras: reciben datos ya consultados
// y devuelven el color con un mensaje que muestra el valor medido y el umbral, o null si la condición no se cumple.
import { cobertura } from '../inventario/calculos/formulas.js';

export type ColorAlerta = 'AMARILLO' | 'ROJO' | 'AZUL';
export interface Resultado {
  color: ColorAlerta;
  mensaje: string;
  datos: Record<string, unknown>;
}

export const UMBRALES_POR_DEFECTO = {
  AL03: { rojoMultiploMax: 2 },
  AL04: { amarilloDias: 30, rojoDias: 15 },
  AL05: { frecuenciaDias: { A: 30, B: 90, C: 180 }, rojoDiasExtra: 7 },
  AL06: { amarilloPct: 0.5, rojoPct: 2 },
  AL07: { amarilloHoras: 24, rojoHoras: 48 },
  AL08: { amarilloDiasExtra: 1, rojoDiasExtra: 2 },
  AL09: { rojoPct: 1 },
  AL10: { amarilloDias: 30, rojoDias: 60 },
  AL11: { amarilloHoras: 2, rojoHoras: 24 },
  AL12: { amarilloHoras: 24, rojoHoras: 48 },
  AL13: { amarilloPct: 10, rojoPct: 15 },
  AL14: { amarilloDias: 21, rojoDias: 7 },
};
export type Umbrales = typeof UMBRALES_POR_DEFECTO;

// Mezcla los umbrales guardados en ConfiguracionSistema sobre los valores por defecto.
export function combinarUmbrales(guardados: Partial<Record<string, object>> | null | undefined): Umbrales {
  const u = structuredClone(UMBRALES_POR_DEFECTO) as Record<string, object>;
  for (const [clave, valor] of Object.entries(guardados ?? {})) if (u[clave]) u[clave] = { ...u[clave], ...valor };
  return u as Umbrales;
}

// En estas alertas un número menor es peor (días que faltan): el amarillo llega antes, con un umbral mayor.
const MENOR_ES_PEOR = new Set(['AL04', 'AL14']);

// Valida un umbral editado: claves conocidas, números ≥ 0 y amarillo antes que rojo. Devuelve el error o null.
export function validarUmbral(clave: string, valor: Record<string, unknown>): string | null {
  const base = (UMBRALES_POR_DEFECTO as Record<string, Record<string, unknown>>)[clave];
  if (!base) return `No existe el umbral ${clave}`;
  for (const [k, v] of Object.entries(valor)) {
    if (!(k in base)) return `${clave} no tiene el campo ${k}`;
    const hojas = typeof v === 'object' && v !== null ? Object.values(v) : [v];
    if (hojas.some((h) => typeof h !== 'number' || !Number.isFinite(h) || h < 0)) return `${clave}.${k} debe ser un número mayor o igual a 0`;
  }
  const u = { ...base, ...valor } as Record<string, number> & { frecuenciaDias?: Record<string, number> };
  if (clave === 'AL03' && !(u.rojoMultiploMax > 1)) return 'AL03.rojoMultiploMax debe ser mayor que 1 (el rojo va después del Máx)';
  if (clave === 'AL05' && Object.values(u.frecuenciaDias!).some((f) => f <= 0)) return 'AL05.frecuenciaDias debe ser mayor que 0 en cada clase';
  if (clave === 'AL09' && !(u.rojoPct > 0)) return 'AL09.rojoPct debe ser mayor que 0';
  for (const k of Object.keys(u).filter((x) => x.startsWith('amarillo'))) {
    const a = u[k];
    const r = u[k.replace('amarillo', 'rojo')];
    if (MENOR_ES_PEOR.has(clave) ? !(a > r) : !(a < r)) {
      return `${clave}: el umbral amarillo (${a}) debe dispararse antes que el rojo (${r})`;
    }
  }
  return null;
}

const res = (color: ColorAlerta, mensaje: string, datos: object): Resultado => ({ color, mensaje, datos: { ...datos } });
const pct = (x: number) => Math.round(x * 100) / 100;

export function al01(e: { posicion: number; rop: number; ss: number; trasladoPropuesto: number }) {
  const extra = `Traslado propuesto: ${e.trasladoPropuesto}.`;
  if (e.posicion <= e.ss) return res('ROJO', `Posición ${e.posicion} ≤ SS ${e.ss}: reposición urgente. ${extra}`, e);
  if (e.posicion <= e.rop) return res('AMARILLO', `Posición ${e.posicion} ≤ ROP ${e.rop}. ${extra}`, e);
  return null;
}

export function al02(e: { vendible: number; disponible: number; trasladoPropuesto: number }) {
  return e.vendible <= 0 ? res('ROJO', `Quiebre: vendible ${Math.max(0, e.vendible)} (disponible ${e.disponible}). Traslado propuesto: ${e.trasladoPropuesto}.`, e) : null;
}

export function al03(e: { disponible: number; maximo: number }, u: Umbrales) {
  const tope = u.AL03.rojoMultiploMax * e.maximo;
  if (e.disponible > tope) return res('ROJO', `Disponible ${e.disponible} > ${u.AL03.rojoMultiploMax} × Máx (${tope}).`, e);
  if (e.disponible > e.maximo) return res('AZUL', `Disponible ${e.disponible} > Máx ${e.maximo}.`, e);
  return null;
}

export function al04(e: { vidaRestanteDias: number; lote: string; cantidad: number }, u: Umbrales) {
  const { amarilloDias, rojoDias } = u.AL04;
  const texto = `Lote ${e.lote} (${e.cantidad} u.) con ${e.vidaRestanteDias} días de vida`;
  if (e.vidaRestanteDias <= rojoDias) return res('ROJO', `${texto} ≤ ${rojoDias}${e.vidaRestanteDias < 15 ? ': ya no se despacha' : ''}.`, e);
  if (e.vidaRestanteDias <= amarilloDias) return res('AMARILLO', `${texto} ≤ ${amarilloDias}.`, e);
  return null;
}

export function al05(e: { diasDesdeConteo: number | null; clase: 'A' | 'B' | 'C' }, u: Umbrales) {
  const f = u.AL05.frecuenciaDias[e.clase];
  const limiteRojo = f + u.AL05.rojoDiasExtra;
  const dias = e.diasDesdeConteo ?? Number.POSITIVE_INFINITY;
  const texto = e.diasDesdeConteo === null ? 'Sin conteo registrado' : `Último conteo hace ${dias} días`;
  if (dias > limiteRojo) return res('ROJO', `${texto} > ${limiteRojo} (clase ${e.clase}: cada ${f} + ${u.AL05.rojoDiasExtra}).`, e);
  if (dias > f) return res('AMARILLO', `${texto} > ${f} (clase ${e.clase}).`, e);
  return null;
}

export function al06(e: { porcentaje: number; diferencia: number; sistema: number }, u: Umbrales) {
  const texto = `Conteo con diferencia ${e.diferencia} sobre ${e.sistema} (${e.porcentaje}%)`;
  if (e.porcentaje > u.AL06.rojoPct) return res('ROJO', `${texto} > ${u.AL06.rojoPct}%.`, e);
  if (e.porcentaje > u.AL06.amarilloPct) return res('AMARILLO', `${texto} > ${u.AL06.amarilloPct}%.`, e);
  return null;
}

// Horas contadas con la fecha simulada: 1 día simulado = 24 h.
function porHoras(horas: number, umbral: { amarilloHoras: number; rojoHoras: number }, texto: string, datos: object) {
  if (horas > umbral.rojoHoras) return res('ROJO', `${texto} hace ${horas} h > ${umbral.rojoHoras} h.`, datos);
  if (horas > umbral.amarilloHoras) return res('AMARILLO', `${texto} hace ${horas} h > ${umbral.amarilloHoras} h.`, datos);
  return null;
}

export const al07 = (e: { horas: number; motivo: string; cantidad: number }, u: Umbrales) =>
  porHoras(e.horas, u.AL07, `Ajuste ${e.motivo.replaceAll('_', ' ').toLowerCase()} (${e.cantidad}) pendiente de aprobación`, e);

export function al08(e: { diasEnTransito: number; leadTimeDias: number; numero: string }, u: Umbrales) {
  const amarillo = e.leadTimeDias + u.AL08.amarilloDiasExtra;
  const rojo = e.leadTimeDias + u.AL08.rojoDiasExtra;
  const texto = `Traslado ${e.numero} con ${e.diasEnTransito} días en tránsito`;
  if (e.diasEnTransito > rojo) return res('ROJO', `${texto} > L + ${u.AL08.rojoDiasExtra} (${rojo}).`, e);
  if (e.diasEnTransito > amarillo) return res('AMARILLO', `${texto} > L + ${u.AL08.amarilloDiasExtra} (${amarillo}).`, e);
  return null;
}

export function al09(e: { diferencia: number; despachada: number; danado: boolean; numero: string }, u: Umbrales) {
  const p = e.despachada ? pct((e.diferencia / e.despachada) * 100) : 0;
  const datos = { ...e, porcentaje: p };
  if (e.danado) return res('ROJO', `Traslado ${e.numero}: producto dañado en la recepción.`, datos);
  if (p > u.AL09.rojoPct) return res('ROJO', `Traslado ${e.numero}: diferencia ${e.diferencia} de ${e.despachada} (${p}%) > ${u.AL09.rojoPct}%.`, datos);
  if (e.diferencia > 0) return res('AMARILLO', `Traslado ${e.numero}: diferencia ${e.diferencia} de ${e.despachada} (${p}%) ≤ ${u.AL09.rojoPct}%.`, datos);
  return null;
}

export function al10(e: { dias: number; pendiente: number; cliente: string }, u: Umbrales) {
  const texto = `${e.cliente} con ${e.pendiente} envases sin devolver desde hace ${e.dias} días`;
  if (e.dias > u.AL10.rojoDias) return res('ROJO', `${texto} > ${u.AL10.rojoDias}.`, e);
  if (e.dias > u.AL10.amarilloDias) return res('AMARILLO', `${texto} > ${u.AL10.amarilloDias}.`, e);
  return null;
}

export const al11 = (e: { horas: number; numero: string }, u: Umbrales) => porHoras(e.horas, u.AL11, `Pedido ${e.numero} pendiente de revisión por falta de stock`, e);

export const al12 = (e: { horas: number; numero: string; cantidad: number }, u: Umbrales) => porHoras(e.horas, u.AL12, `Reserva del pedido ${e.numero} (${e.cantidad} u.) sin despacho`, e);

export function al13(e: { costoNuevo: number; costoAnterior: number; lote: string }, u: Umbrales) {
  const variacion = e.costoAnterior ? pct((Math.abs(e.costoNuevo - e.costoAnterior) / e.costoAnterior) * 100) : 0;
  const datos = { ...e, variacionPct: variacion };
  const texto = `Lote ${e.lote}: costo ${e.costoNuevo} vs. ${e.costoAnterior} de la capa anterior (${variacion}%)`;
  if (variacion > u.AL13.rojoPct) return res('ROJO', `${texto} > ${u.AL13.rojoPct}%.`, datos);
  if (variacion > u.AL13.amarilloPct) return res('AMARILLO', `${texto} > ${u.AL13.amarilloPct}%.`, datos);
  return null;
}

export function al14(e: { diasParaFiesta: number; posicion: number; pronostico: number; fiesta: string }, u: Umbrales) {
  if (e.posicion >= e.pronostico || e.diasParaFiesta > u.AL14.amarilloDias) return null;
  const texto = `${e.fiesta} en ${e.diasParaFiesta} días: posición ${e.posicion} < pronóstico ${e.pronostico}`;
  if (e.diasParaFiesta <= u.AL14.rojoDias) return res('ROJO', `${texto} (faltan ≤ ${u.AL14.rojoDias} días).`, e);
  return res('AMARILLO', `${texto} (faltan ≤ ${u.AL14.amarilloDias} días).`, e);
}

export function al15(e: { vendible: number; demandaDiaria: number; diasRestantes: number; promocion: string }) {
  const cob = cobertura(Math.max(0, e.vendible), e.demandaDiaria);
  const datos = { ...e, coberturaDias: cob };
  if (e.vendible <= 0) return res('ROJO', `Promoción ${e.promocion} sin stock vendible.`, datos);
  // Se compara sin redondear: 11.95 días no alcanzan para 12 aunque se muestren como 12.0.
  if (Math.max(0, e.vendible) / e.demandaDiaria < e.diasRestantes) return res('AMARILLO', `Promoción ${e.promocion}: cobertura ${cob} días < ${e.diasRestantes} días restantes.`, datos);
  return null;
}

export function al16(e: { estado: string; tipo: string; referencia: string; intentos: number }) {
  const texto = `Evento ${e.tipo} (${e.referencia}), ${e.intentos} intento(s)`;
  if (e.estado === 'COLA_ERRORES') return res('ROJO', `${texto}: en cola de errores.`, e);
  if (e.estado === 'REINTENTO') return res('AMARILLO', `${texto}: en reintento.`, e);
  return null;
}

// Responsable y acción sugerida por alerta (sección 8 y responsables de la sección 7.2 del documento principal).
export const CATALOGO: Record<string, { nombre: string; roles: string[]; accion: string }> = {
  AL01: { nombre: 'Reposición', roles: ['R07'], accion: 'Emitir un traslado desde el almacén con más cobertura (ver la propuesta de traslados).' },
  AL02: { nombre: 'Quiebre', roles: ['R07', 'R02'], accion: 'R07 emite un traslado urgente; se avisa a R02 para que preventa no comprometa el artículo.' },
  AL03: { nombre: 'Exceso', roles: ['R07'], accion: 'Frenar traslados hacia el almacén, redistribuir el excedente o proponer una rotación de exceso.' },
  AL04: { nombre: 'Vencimiento próximo', roles: ['R06'], accion: 'Despachar el lote primero; con 15 a 30 días proponer liquidación; con menos de 15 días pasarlo a cuarentena.' },
  AL05: { nombre: 'Conteo cíclico atrasado', roles: ['R06'], accion: 'Programar y registrar el conteo cíclico del artículo.' },
  AL06: { nombre: 'Diferencia de conteo', roles: ['R06', 'R07'], accion: 'R06 recuenta; R07 aprueba o rechaza el ajuste.' },
  AL07: { nombre: 'Ajuste o merma pendiente', roles: ['R07'], accion: 'Aprobar o rechazar el ajuste o la merma.' },
  AL08: { nombre: 'Traslado sin recepción', roles: ['R06'], accion: 'R06 del destino confirma la recepción o reporta el problema del transporte.' },
  AL09: { nombre: 'Diferencia en recepción', roles: ['R06', 'R07'], accion: 'R06 documenta la diferencia o el daño; R07 decide el ajuste.' },
  AL10: { nombre: 'Envases sin devolver', roles: ['R06', 'R02'], accion: 'Gestionar la devolución de envases con el cliente; R02 coordina con preventa.' },
  AL11: { nombre: 'Pedido pendiente por falta de stock', roles: ['R03'], accion: 'Revisar el pedido: reprogramar, sustituir el artículo o cancelar.' },
  AL12: { nombre: 'Reserva sin despacho', roles: ['R06'], accion: 'Despachar el pedido o liberar la reserva.' },
  AL13: { nombre: 'Costo FIFO atípico', roles: ['R07'], accion: 'Verificar el costo de la entrada antes de valorizar salidas.' },
  AL14: { nombre: 'Fiesta próxima con cobertura baja', roles: ['R07'], accion: 'Preparar traslados para la fiesta según el pronóstico.' },
  AL15: { nombre: 'Promoción con stock insuficiente', roles: ['R02', 'R07'], accion: 'Reponer stock o ajustar el tope o la vigencia de la promoción.' },
  AL16: { nombre: 'Falla de integración', roles: ['R09'], accion: 'Revisar el evento y reprocesarlo.' },
};

export const NIVELES_ESCALAMIENTO = ['Responsable', 'R07 Coordinador de logística', 'Gerente de Logística y Ventas'];

// Escalamiento de una alerta ROJA no atendida: > 24 h en rojo sube a R07, > 48 h al Gerente.
export const nivelPorHorasEnRojo = (horas: number) => (horas > 48 ? 2 : horas > 24 ? 1 : 0);
