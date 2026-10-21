// Evaluación de alertas contra la base: consulta los datos, aplica los evaluadores puros y sincroniza el ciclo de vida
// (crear, cambiar de color, resolver, escalar). Idempotente: evaluar dos veces seguidas no cambia nada.
import type { Alerta, Prisma, PrismaClient } from '../generated/prisma/client.js';
import { pronosticoFiesta, vidaRestanteDias } from '../inventario/calculos/formulas.js';
import type { Par } from '../inventario/motor.js';
import { obtenerStock } from '../inventario/stock.js';
import * as ev from './evaluadores.js';

const MS_DIA = 86_400_000;
const dias = (desde: Date, hasta: Date) => Math.round((hasta.getTime() - desde.getTime()) / MS_DIA);

// Alertas de un artículo en un almacén: tras una operación solo se reevalúan las del par afectado.
// Las demás (ajustes, traslados, envases, pedidos, integración) se reevalúan siempre completas.
export const CODIGOS_POR_PAR = ['AL01', 'AL02', 'AL03', 'AL04', 'AL05', 'AL06', 'AL13', 'AL14', 'AL15'];

interface Calculada extends ev.Resultado {
  codigo: string;
  almacenId: number | null;
  articuloId: number | null;
  referenciaTipo: string;
  referenciaId: number | null;
}

export const claveAlerta = (c: Pick<Calculada, 'codigo' | 'almacenId' | 'articuloId' | 'referenciaTipo' | 'referenciaId'>) =>
  [c.codigo, c.almacenId ?? '-', c.articuloId ?? '-', c.referenciaTipo, c.referenciaId ?? '-'].join('|');

export async function evaluarAlertas(prisma: PrismaClient, alcance: { pares?: Par[] } = {}) {
  return prisma.$transaction(
    async (tx) => {
      // Evaluaciones en serie: dos operaciones simultáneas no crean la misma alerta dos veces.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(20270630)`;
      const config = await tx.configuracionSistema.findMany({ where: { clave: { in: ['fechaSimulada', 'umbralesAlertas', 'diasMinimosVidaDespacho'] } } });
      const valor = (clave: string) => config.find((c) => c.clave === clave)?.valor;
      const fecha = new Date(`${(valor('fechaSimulada') as string | undefined) ?? '2027-06-30'}T00:00:00Z`);
      const u = ev.combinarUmbrales(valor('umbralesAlertas') as Record<string, object> | undefined);
      const diasMinimos = (valor('diasMinimosVidaDespacho') as number | undefined) ?? 15;

      const almacenes = await tx.almacen.findMany();
      // Un almacén de tránsito pertenece a su planta destino: sus alertas se muestran allí.
      const plantaDe = new Map(almacenes.map((a) => [a.id, a.tipo === 'PLANTA' ? a.id : (almacenes.find((p) => p.almacenTransitoId === a.id)?.id ?? a.id)]));
      const pares = alcance.pares ? new Set(alcance.pares.map((p) => `${p.articuloId}:${plantaDe.get(p.almacenId)}`)) : null;
      const enAlcance = (articuloId: number, almacenId: number) => !pares || pares.has(`${articuloId}:${almacenId}`);

      const calculadas: Calculada[] = [];
      const agregar = (codigo: string, r: ev.Resultado | null, almacenId: number | null, articuloId: number | null, referenciaTipo: string, referenciaId: number | null) => {
        if (r) calculadas.push({ ...r, codigo, almacenId, articuloId, referenciaTipo, referenciaId });
      };

      // Consultas secuenciales: una transacción usa una sola conexión.
      const parametros = await tx.parametroArticuloAlmacen.findMany({ where: { almacen: { tipo: 'PLANTA' } } });
      const capas = await tx.capaFifo.findMany({ where: { almacen: { tipo: 'PLANTA' } }, orderBy: [{ fechaEntrada: 'asc' }, { id: 'asc' }] });
      const ajustes = await tx.ajusteInventario.findMany({ where: { estado: 'PENDIENTE' }, include: { conteo: true }, orderBy: { id: 'asc' } });
      const promociones = await tx.promocion.findMany({ where: { estado: 'ACTIVA', fechaInicio: { lte: fecha }, fechaFin: { gte: fecha } } });
      const fiestas = await tx.fiesta.findMany({ where: { fechaFin: { gte: fecha } } });

      for (const alm of almacenes.filter((a) => a.tipo === 'PLANTA')) {
        for (const s of await obtenerStock(tx, alm.id, fecha, diasMinimos)) {
          if (!enAlcance(s.articuloId, alm.id)) continue;
          const p = parametros.find((x) => x.articuloId === s.articuloId && x.almacenId === alm.id)!;
          const add = (codigo: string, r: ev.Resultado | null, refTipo = 'Articulo', refId: number | null = s.articuloId) => agregar(codigo, r, alm.id, s.articuloId, refTipo, refId);

          const quiebre = ev.al02({ vendible: s.vendible, disponible: s.disponible, trasladoPropuesto: s.trasladoPropuesto });
          add('AL02', quiebre);
          // Con quiebre, AL02 ya informa el traslado propuesto: no se duplica con AL01.
          if (!quiebre) add('AL01', ev.al01({ posicion: s.posicion, rop: s.rop, ss: s.stockSeguridad, trasladoPropuesto: s.trasladoPropuesto }));
          add('AL03', ev.al03({ disponible: s.disponible, maximo: s.stockMaximo }, u));
          add('AL05', ev.al05({ diasDesdeConteo: p.ultimoConteo ? dias(p.ultimoConteo, fecha) : null, clase: p.claseAbc }, u));

          const propias = capas.filter((c) => c.articuloId === s.articuloId && c.almacenId === alm.id);
          // AL04 por capa: cada lote con poca vida es una decisión distinta (liquidar, cuarentena).
          for (const c of propias.filter((x) => x.estado === 'DISPONIBLE' && x.cantidadRestante > 0)) {
            add('AL04', ev.al04({ vidaRestanteDias: vidaRestanteDias(c.fechaVencimiento, fecha), lote: c.lote, cantidad: c.cantidadRestante }, u), 'CapaFifo', c.id);
          }
          // AL13: cada capa con saldo contra la capa anterior (las divisiones del mismo lote no cuentan).
          propias.forEach((c, i) => {
            const anterior = propias[i - 1];
            if (!anterior || c.cantidadRestante === 0 || anterior.lote === c.lote) return;
            add('AL13', ev.al13({ costoNuevo: Number(c.costoUnitario), costoAnterior: Number(anterior.costoUnitario), lote: c.lote }, u), 'CapaFifo', c.id);
          });
          // AL06: permanece mientras el ajuste del conteo siga pendiente.
          const conteo = ajustes.filter((a) => a.conteo && a.articuloId === s.articuloId && a.almacenId === alm.id).at(-1)?.conteo;
          if (conteo) add('AL06', ev.al06({ porcentaje: conteo.porcentaje, diferencia: conteo.diferencia, sistema: conteo.cantidadSistema }, u), 'ConteoFisico', conteo.id);

          for (const f of fiestas.filter((x) => x.zonas.includes(alm.codigo))) {
            const pronostico = pronosticoFiesta(s.demandaDiaria, f.factor, f.diasFiesta);
            add('AL14', ev.al14({ diasParaFiesta: Math.max(0, dias(fecha, f.fechaInicio)), posicion: s.posicion, pronostico, fiesta: f.nombre }, u), 'Fiesta', f.id);
          }
          for (const pr of promociones.filter((x) => x.articuloId === s.articuloId && (x.almacenId === null || x.almacenId === alm.id))) {
            add('AL15', ev.al15({ vendible: s.vendible, demandaDiaria: s.demandaDiaria, diasRestantes: dias(fecha, pr.fechaFin), promocion: pr.nombre }), 'Promocion', pr.id);
          }
        }
      }

      for (const a of ajustes) {
        agregar('AL07', ev.al07({ horas: dias(a.fechaRegistro, fecha) * 24, motivo: a.motivo, cantidad: a.cantidad }, u), plantaDe.get(a.almacenId)!, a.articuloId, 'AjusteInventario', a.id);
      }

      const traslados = await tx.ordenTraslado.findMany({ where: { estado: 'EN_TRANSITO' }, include: { destino: true, lineas: true } });
      for (const o of traslados.filter((x) => x.fechaDespacho)) {
        const articuloId = o.lineas.length === 1 ? o.lineas[0].articuloId : null;
        agregar('AL08', ev.al08({ diasEnTransito: dias(o.fechaDespacho!, fecha), leadTimeDias: o.destino.leadTimeDias, numero: o.numero }, u), o.destinoId, articuloId, 'OrdenTraslado', o.id);
      }

      // AL09: vigente mientras la diferencia siga pendiente de decisión o lo dañado siga en cuarentena.
      const recibidas = await tx.lineaTraslado.findMany({ where: { cantidadRecibida: { not: null } }, include: { orden: true } });
      for (const l of recibidas) {
        const diferencia = l.cantidadDespachada - l.cantidadRecibida!;
        const pendiente = ajustes.some((a) => a.motivo === 'DIFERENCIA_RECEPCION' && a.ordenTrasladoId === l.ordenId && a.articuloId === l.articuloId);
        const danado =
          l.estadoRecepcion === 'DANADO' &&
          capas.some((c) => c.ordenTrasladoId === l.ordenId && c.articuloId === l.articuloId && c.almacenId === l.orden.destinoId && c.estado === 'CUARENTENA' && c.cantidadRestante > 0);
        if (!pendiente && !danado) continue;
        agregar('AL09', ev.al09({ diferencia: pendiente ? diferencia : 0, despachada: l.cantidadDespachada, danado, numero: l.orden.numero }, u), l.orden.destinoId, l.articuloId, 'OrdenTraslado', l.ordenId);
      }

      // AL10 por cliente y envase: antigüedad de la entrega pendiente más antigua.
      const saldos = await tx.saldoEnvase.findMany({ include: { cliente: true }, orderBy: { fechaEntrega: 'asc' } });
      const grupos = new Map<string, { clienteId: number; cliente: string; articuloId: number; almacenId: number; pendiente: number; desde: Date }>();
      for (const s of saldos.filter((x) => x.cantidadEntregada > x.cantidadDevuelta)) {
        const k = `${s.clienteId}:${s.articuloId}:${s.almacenId}`;
        const g = grupos.get(k) ?? { clienteId: s.clienteId, cliente: s.cliente.codigo, articuloId: s.articuloId, almacenId: s.almacenId, pendiente: 0, desde: s.fechaEntrega };
        g.pendiente += s.cantidadEntregada - s.cantidadDevuelta;
        grupos.set(k, g);
      }
      for (const g of grupos.values()) agregar('AL10', ev.al10({ dias: dias(g.desde, fecha), pendiente: g.pendiente, cliente: g.cliente }, u), g.almacenId, g.articuloId, 'Cliente', g.clienteId);

      const pedidos = await tx.pedidoSimulado.findMany({ where: { estado: { in: ['PENDIENTE_REVISION', 'CONFIRMADO'] } }, include: { lineas: true } });
      for (const p of pedidos) {
        const horas = dias(p.fechaOperacion, fecha) * 24;
        if (p.estado === 'PENDIENTE_REVISION') agregar('AL11', ev.al11({ horas, numero: p.numero }, u), p.almacenId, null, 'PedidoSimulado', p.id);
        else agregar('AL12', ev.al12({ horas, numero: p.numero, cantidad: p.lineas.reduce((s, l) => s + l.cantidad, 0) }, u), p.almacenId, null, 'PedidoSimulado', p.id);
      }

      const eventos = await tx.eventoIntegracion.findMany({ where: { estado: { in: ['REINTENTO', 'COLA_ERRORES'] } } });
      for (const e of eventos) agregar('AL16', ev.al16(e), null, null, 'EventoIntegracion', e.id);

      return sincronizar(tx, calculadas, fecha, (a) => !CODIGOS_POR_PAR.includes(a.codigo) || (a.articuloId !== null && a.almacenId !== null && enAlcance(a.articuloId, a.almacenId)));
    },
    { timeout: 30_000, maxWait: 20_000 },
  );
}

async function sincronizar(tx: Prisma.TransactionClient, calculadas: Calculada[], fecha: Date, enAlcance: (a: Alerta) => boolean) {
  const abiertas = await tx.alerta.findMany({ where: { estado: { in: ['ABIERTA', 'ATENDIDA'] } } });
  const vigentes = new Map(abiertas.map((a) => [a.clave, a]));
  const vistas = new Set<string>();
  const r = { creadas: 0, cambiosColor: 0, resueltas: 0, escaladas: 0 };

  for (const c of calculadas) {
    const clave = claveAlerta(c);
    vistas.add(clave);
    const datos = c.datos as Prisma.InputJsonObject;
    const actual = vigentes.get(clave);
    if (!actual) {
      const { roles, accion } = ev.CATALOGO[c.codigo];
      const nueva = await tx.alerta.create({
        data: { clave, codigo: c.codigo, color: c.color, almacenId: c.almacenId, articuloId: c.articuloId, referenciaTipo: c.referenciaTipo, referenciaId: c.referenciaId, mensaje: c.mensaje, rolesResponsables: roles, accionSugerida: accion, datos, fechaOperacion: fecha, fechaColor: fecha },
      });
      await tx.historialAlerta.create({ data: { alertaId: nueva.id, tipo: 'CREADA', colorNuevo: c.color, detalle: c.mensaje, fechaOperacion: fecha } });
      vigentes.set(clave, nueva);
      r.creadas++;
    } else if (actual.color !== c.color) {
      vigentes.set(clave, await tx.alerta.update({ where: { id: actual.id }, data: { color: c.color, fechaColor: fecha, mensaje: c.mensaje, datos } }));
      await tx.historialAlerta.create({ data: { alertaId: actual.id, tipo: 'CAMBIO_COLOR', colorAnterior: actual.color, colorNuevo: c.color, detalle: c.mensaje, fechaOperacion: fecha } });
      r.cambiosColor++;
    } else if (actual.mensaje !== c.mensaje) {
      vigentes.set(clave, await tx.alerta.update({ where: { id: actual.id }, data: { mensaje: c.mensaje, datos } }));
    }
  }

  // La condición desapareció: se resuelve sola. Si estaba atendida conserva el resultado de la atención.
  for (const a of abiertas.filter((x) => !vistas.has(x.clave) && enAlcance(x))) {
    await tx.alerta.update({ where: { id: a.id }, data: { estado: 'RESUELTA', fechaResolucion: fecha, resultado: a.estado === 'ATENDIDA' ? a.resultado : 'condición normalizada' } });
    await tx.historialAlerta.create({ data: { alertaId: a.id, tipo: 'RESUELTA', detalle: 'condición normalizada', fechaOperacion: fecha } });
    vigentes.delete(a.clave);
    r.resueltas++;
  }

  // Escalamiento: roja, abierta y sin atender, medido desde que se puso en rojo.
  for (const a of vigentes.values()) {
    if (a.estado !== 'ABIERTA' || a.color !== 'ROJO') continue;
    const nivel = ev.nivelPorHorasEnRojo(dias(a.fechaColor, fecha) * 24);
    if (nivel <= a.nivelEscalamiento) continue;
    await tx.alerta.update({ where: { id: a.id }, data: { nivelEscalamiento: nivel } });
    for (let n = a.nivelEscalamiento + 1; n <= nivel; n++) {
      await tx.historialAlerta.create({ data: { alertaId: a.id, tipo: 'ESCALADA', nivel: n, detalle: `Escalada a ${ev.NIVELES_ESCALAMIENTO[n]}`, fechaOperacion: fecha } });
    }
    r.escaladas++;
  }
  return { ...r, abiertas: vigentes.size, fechaOperacion: fecha.toISOString().slice(0, 10) };
}
