import { Injectable } from '@nestjs/common';
import { ErrorNegocio } from '../comun/errores.js';
import { combinarUmbrales } from '../alertas/evaluadores.js';
import { costoConservacion, pronosticoFiesta, qFiesta, ropFiesta, TIPOS_FISICOS, vidaRestanteDias } from '../inventario/calculos/formulas.js';
import { obtenerStock, resolverAlmacen } from '../inventario/stock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulacionService } from '../simulacion/simulacion.service.js';

const MS_DIA = 86_400_000;
const r2 = (x: number) => Math.round(x * 100) / 100;
const dia = (f: Date) => f.toISOString().slice(0, 10);
const masDias = (f: Date, n: number) => new Date(f.getTime() + n * MS_DIA);
const VIGENTES = { in: ['ABIERTA', 'ATENDIDA'] as ('ABIERTA' | 'ATENDIDA')[] };

@Injectable()
export class AnalisisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
  ) {}

  // Plantas del filtro (sin almacén: las tres), en el orden del seed: LP, CB, SC.
  private async plantas(almacenParam?: string) {
    if (!almacenParam) return this.prisma.almacen.findMany({ where: { tipo: 'PLANTA' }, orderBy: { id: 'asc' } });
    const a = await resolverAlmacen(this.prisma, almacenParam);
    if (a.tipo !== 'PLANTA') throw new ErrorNegocio(400, 'ALMACEN_INVALIDO', `${a.codigo} es un almacén de tránsito`);
    return [a];
  }

  async tablero(almacenParam?: string) {
    const plantas = await this.plantas(almacenParam);
    const ids = plantas.map((p) => p.id);
    const transitos = plantas.map((p) => p.almacenTransitoId!).filter(Boolean);
    const fecha = await this.simulacion.fechaOperacion();
    const diasMinimos = await this.simulacion.diasMinimosDespacho();
    const umbralVence = combinarUmbrales(await this.simulacion.valor('umbralesAlertas', null)).AL04.amarilloDias;

    const capas = await this.prisma.capaFifo.findMany({ where: { almacenId: { in: ids }, cantidadRestante: { gt: 0 }, estado: { in: ['DISPONIBLE', 'CUARENTENA'] } } });
    const valorDe = (estado: string, almacenId?: number) =>
      r2(capas.filter((c) => c.estado === estado && (!almacenId || c.almacenId === almacenId)).reduce((s, c) => s + c.cantidadRestante * Number(c.costoUnitario), 0));

    const estados = { enQuiebre: 0, bajoRop: 0, normales: 0, enExceso: 0, venceEn30Dias: 0 };
    let disponibleTotal = 0;
    let demandaTotal = 0;
    // Pares artículo/almacén evaluados; un par puede estar a la vez en exceso y próximo a vencer.
    let pares = 0;
    for (const p of plantas) {
      for (const s of await obtenerStock(this.prisma, p.id, fecha, diasMinimos)) {
        pares++;
        const quiebre = s.vendible <= 0;
        const bajo = !quiebre && s.posicion <= s.rop;
        const exceso = s.disponible > s.stockMaximo;
        if (quiebre) estados.enQuiebre++;
        if (bajo) estados.bajoRop++;
        if (exceso) estados.enExceso++;
        if (!quiebre && !bajo && !exceso) estados.normales++;
        const vence = capas.some((c) => c.almacenId === p.id && c.articuloId === s.articuloId && c.estado === 'DISPONIBLE' && vidaRestanteDias(c.fechaVencimiento, fecha) <= umbralVence);
        if (vence) estados.venceEn30Dias++;
        disponibleTotal += Math.max(0, s.disponible);
        demandaTotal += s.demandaDiaria;
      }
    }

    const alertas = await this.prisma.alerta.findMany({ where: { estado: VIGENTES, ...(almacenParam ? { almacenId: { in: ids } } : {}) } });
    const traslados = await this.prisma.ordenTraslado.findMany({ where: { estado: 'EN_TRANSITO', destinoId: { in: ids } }, include: { lineas: true } });
    const desde90 = masDias(fecha, -90);
    const conteos = await this.prisma.conteoFisico.findMany({ where: { almacenId: { in: ids }, fechaOperacion: { gt: desde90, lte: fecha } } });

    // Últimos 30 días hábiles (lunes a viernes) cerrados: hasta el día anterior a la fecha simulada (hoy aún no termina).
    const habiles: Date[] = [];
    for (let f = masDias(fecha, -1); habiles.length < 30; f = masDias(f, -1)) if (f.getUTCDay() % 6 !== 0) habiles.unshift(f);
    const ventas = await this.prisma.movimiento.findMany({
      where: { tipo: 'SALIDA', almacenId: { in: ids }, fechaOperacion: { gte: habiles[0], lt: fecha } },
      select: { fechaOperacion: true, cantidad: true, articulo: { select: { precio: true } } },
    });

    return {
      almacen: almacenParam ? plantas[0].codigo : null,
      fechaOperacion: dia(fecha),
      valorInventario: valorDe('DISPONIBLE'),
      valorCuarentena: valorDe('CUARENTENA'),
      articulos: { total: pares, ...estados },
      alertas: {
        total: alertas.length,
        porColor: { ROJO: 0, AMARILLO: 0, AZUL: 0, ...alertas.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.color]: (acc[a.color] ?? 0) + 1 }), {}) },
        sinAtender: alertas.filter((a) => a.estado === 'ABIERTA').length,
        rojasSinAtender: alertas.filter((a) => a.estado === 'ABIERTA' && a.color === 'ROJO').length,
        escaladas: alertas.filter((a) => a.nivelEscalamiento > 0).length,
      },
      // Ponderada por demanda: Σ(cobertura × d) ÷ Σ d = Σ disponible ÷ Σ d.
      coberturaMediaDias: demandaTotal ? Math.round((disponibleTotal / demandaTotal) * 10) / 10 : 0,
      trasladosEnTransito: { ordenes: traslados.length, unidades: traslados.reduce((s, o) => s + o.lineas.reduce((t, l) => t + l.cantidadDespachada, 0), 0) },
      ajustesPendientes: await this.prisma.ajusteInventario.count({ where: { estado: 'PENDIENTE', almacenId: { in: [...ids, ...transitos] } } }),
      pedidosPendientesRevision: await this.prisma.pedidoSimulado.count({ where: { estado: 'PENDIENTE_REVISION', almacenId: { in: ids } } }),
      exactitudInventario: {
        porcentaje: conteos.length ? Math.round((conteos.filter((c) => c.diferencia === 0).length / conteos.length) * 1000) / 10 : null,
        conteos: conteos.length,
        sinDiferencia: conteos.filter((c) => c.diferencia === 0).length,
        desde: dia(masDias(desde90, 1)),
      },
      ventasDiarias: habiles.map((f) => {
        const delDia = ventas.filter((v) => v.fechaOperacion.getTime() === f.getTime());
        return { fecha: dia(f), unidades: -delDia.reduce((s, v) => s + v.cantidad, 0), usd: r2(-delDia.reduce((s, v) => s + v.cantidad * Number(v.articulo.precio), 0)) };
      }),
      valorPorAlmacen: plantas.map((p) => ({ almacen: p.codigo, nombre: p.nombre, valor: valorDe('DISPONIBLE', p.id) })),
    };
  }

  // Costos del mes (sección 10, fórmula del documento): adquisición, conservación, pedido y agotamiento por artículo.
  async costos(almacenParam?: string, mesParam?: string) {
    const plantas = await this.plantas(almacenParam);
    const ids = plantas.map((p) => p.id);
    const fecha = await this.simulacion.fechaOperacion();
    const mes = mesParam ?? dia(fecha).slice(0, 7);
    const inicio = new Date(`${mes}-01T00:00:00Z`);
    const fin = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1));
    // El stock promedio se mide hasta el último día del mes o hasta la fecha simulada si el mes está en curso.
    const ultimoDia = fecha < masDias(fin, -1) ? fecha : masDias(fin, -1);
    const tasaConservacionAnual = await this.simulacion.valor('tasaConservacionAnual', 0.15);
    const costoPorTraslado = await this.simulacion.valor('costoPorTraslado', 180);
    const valorPedido = await this.simulacion.valor('valorPedidoAgotamiento', 40);
    const margen = await this.simulacion.valor('margenAgotamiento', 0.3);
    const costoAgotamientoPorPedido = r2(valorPedido * margen);

    const articulos = await this.prisma.articulo.findMany({ orderBy: { codigo: 'asc' } });
    const filas = new Map(
      articulos.map((a) => [a.id, { codigo: a.codigo, descripcion: a.descripcion, unidadesVendidas: 0, adquisicion: 0, stockPromedioUnidades: 0, valorStockPromedio: 0, conservacion: 0, traslados: 0, pedido: 0, pedidosConFaltante: 0, agotamiento: 0, total: 0 }]),
    );

    // Valor del stock al cierre de cada día = Σ valor de los movimientos físicos hasta ese día (cada uno valorado a su costo FIFO).
    const movs = await this.prisma.movimiento.findMany({
      where: { almacenId: { in: ids }, tipo: { in: [...TIPOS_FISICOS] }, fechaOperacion: { lt: fin } },
      select: { articuloId: true, almacenId: true, tipo: true, cantidad: true, valor: true, fechaOperacion: true },
      orderBy: [{ fechaOperacion: 'asc' }, { id: 'asc' }],
    });
    const dias = ultimoDia >= inicio ? Math.round((ultimoDia.getTime() - inicio.getTime()) / MS_DIA) + 1 : 0;
    for (const p of plantas) {
      for (const a of articulos) {
        const propios = movs.filter((m) => m.almacenId === p.id && m.articuloId === a.id);
        const fila = filas.get(a.id)!;
        let i = 0;
        let unidades = 0;
        let valor = 0;
        let sumaUnidades = 0;
        let sumaValor = 0;
        for (let d = 0; d < dias; d++) {
          const cierre = masDias(inicio, d);
          for (; i < propios.length && propios[i].fechaOperacion <= cierre; i++) {
            unidades += propios[i].cantidad;
            valor += Number(propios[i].valor);
          }
          sumaUnidades += unidades;
          sumaValor += valor;
        }
        if (dias) {
          fila.stockPromedioUnidades += sumaUnidades / dias;
          fila.valorStockPromedio += sumaValor / dias;
        }
        for (const m of propios.filter((x) => x.tipo === 'SALIDA' && x.fechaOperacion >= inicio)) {
          fila.unidadesVendidas -= m.cantidad;
          fila.adquisicion -= Number(m.valor);
        }
      }
    }

    // Pedido: cada traslado despachado en el mes hacia el almacén cuesta costoPorTraslado, repartido entre sus líneas.
    const traslados = await this.prisma.ordenTraslado.findMany({ where: { destinoId: { in: ids }, fechaDespacho: { gte: inicio, lt: fin } }, include: { lineas: true } });
    for (const o of traslados) {
      for (const l of o.lineas) {
        const fila = filas.get(l.articuloId)!;
        fila.traslados += 1 / o.lineas.length;
        fila.pedido += costoPorTraslado / o.lineas.length;
      }
    }
    // Agotamiento: cada pedido con faltante del mes cuesta valorPedido × margen, repartido entre sus líneas.
    const conFaltante = await this.prisma.pedidoSimulado.findMany({ where: { conFaltante: true, almacenId: { in: ids }, fechaOperacion: { gte: inicio, lt: fin } }, include: { lineas: true } });
    for (const p of conFaltante) {
      for (const l of p.lineas) {
        const fila = filas.get(l.articuloId)!;
        fila.pedidosConFaltante += 1 / p.lineas.length;
        fila.agotamiento += costoAgotamientoPorPedido / p.lineas.length;
      }
    }

    const resultado = [...filas.values()].map((f) => {
      const conservacion = costoConservacion(f.valorStockPromedio, tasaConservacionAnual);
      const fila = {
        ...f,
        adquisicion: r2(f.adquisicion),
        stockPromedioUnidades: Math.round(f.stockPromedioUnidades),
        valorStockPromedio: r2(f.valorStockPromedio),
        conservacion,
        traslados: r2(f.traslados),
        pedido: r2(f.pedido),
        pedidosConFaltante: r2(f.pedidosConFaltante),
        agotamiento: r2(f.agotamiento),
      };
      return { ...fila, total: r2(fila.adquisicion + fila.conservacion + fila.pedido + fila.agotamiento) };
    });
    const sumar = (k: 'adquisicion' | 'conservacion' | 'pedido' | 'agotamiento' | 'total' | 'valorStockPromedio') => r2(resultado.reduce((s, f) => s + f[k], 0));
    return {
      mes,
      almacen: almacenParam ? plantas[0].codigo : null,
      diasConsiderados: dias,
      tasas: { tasaConservacionAnual, costoPorTraslado, valorPedidoAgotamiento: valorPedido, margenAgotamiento: margen, costoAgotamientoPorPedido },
      articulos: resultado,
      total: {
        adquisicion: sumar('adquisicion'),
        conservacion: sumar('conservacion'),
        pedido: sumar('pedido'),
        agotamiento: sumar('agotamiento'),
        total: sumar('total'),
        valorStockPromedio: sumar('valorStockPromedio'),
        traslados: traslados.length,
        pedidosConFaltante: conFaltante.length,
      },
    };
  }

  // Preparación de fiestas (sección 9) con las funciones puras: ROP, Q y Máx de fiesta, pronóstico y brecha.
  async preparacionFiestas(almacenParam?: string) {
    const plantas = await this.plantas(almacenParam);
    const fecha = await this.simulacion.fechaOperacion();
    const diasMinimos = await this.simulacion.diasMinimosDespacho();
    const fiestas = await this.prisma.fiesta.findMany({ orderBy: { fechaInicio: 'asc' } });
    const parametros = await this.prisma.parametroArticuloAlmacen.findMany({ where: { almacenId: { in: plantas.map((p) => p.id) } } });
    const stock = new Map<number, Awaited<ReturnType<typeof obtenerStock>>>();
    for (const p of plantas) stock.set(p.id, await obtenerStock(this.prisma, p.id, fecha, diasMinimos));

    return {
      fechaOperacion: dia(fecha),
      fiestas: fiestas.map((f) => {
        const diasFaltan = Math.round((f.fechaInicio.getTime() - fecha.getTime()) / MS_DIA);
        const pasada = f.fechaFin < fecha;
        return {
          id: f.id,
          nombre: f.nombre,
          fechaInicio: dia(f.fechaInicio),
          fechaFin: dia(f.fechaFin),
          diasFiesta: f.diasFiesta,
          factor: f.factor,
          zonas: f.zonas,
          semanasPreparacion: f.semanasPreparacion,
          diasFaltan,
          pasada,
          enVentanaPreparacion: !pasada && diasFaltan <= f.semanasPreparacion * 7,
          almacenes: plantas
            .filter((p) => f.zonas.includes(p.codigo))
            .map((p) => ({
              almacen: p.codigo,
              articulos: stock.get(p.id)!.map((s) => {
                const par = parametros.find((x) => x.almacenId === p.id && x.articuloId === s.articuloId)!;
                const rop = ropFiesta(s.demandaDiaria, f.factor, par.leadTimeDias, par.stockSeguridad);
                const q = qFiesta(s.demandaDiaria, f.factor);
                const pronostico = pronosticoFiesta(s.demandaDiaria, f.factor, f.diasFiesta);
                // Crítico: la posición no cubre ni el pronóstico (AL14); en riesgo: no llega al ROP de fiesta.
                const estado = s.posicion < pronostico ? 'CRITICO' : s.posicion < rop ? 'EN_RIESGO' : 'OK';
                return { codigo: s.codigo, descripcion: s.descripcion, demandaBase: s.demandaDiaria, ropFiesta: rop, qFiesta: q, maximoFiesta: rop + q, pronostico, posicion: s.posicion, brecha: pronostico - s.posicion, estado };
              }),
            })),
        };
      }),
    };
  }

  // Pareto de ajustes y mermas APROBADOS por motivo, por valor absoluto en USD (impacto, sea baja o alta).
  async paretoAjustes(almacenParam?: string, desde?: string, hasta?: string) {
    const plantas = await this.plantas(almacenParam);
    const ids = [...plantas.map((p) => p.id), ...plantas.map((p) => p.almacenTransitoId!).filter(Boolean)];
    const ajustes = await this.prisma.ajusteInventario.findMany({
      where: { estado: 'APROBADO', almacenId: { in: ids }, fechaResolucion: { gte: desde ? new Date(`${desde}T00:00:00Z`) : undefined, lte: hasta ? new Date(`${hasta}T00:00:00Z`) : undefined } },
    });
    const movs = await this.prisma.movimiento.findMany({ where: { documentoTipo: 'AjusteInventario', documentoId: { in: ajustes.map((a) => a.id) } }, select: { documentoId: true, valor: true } });
    const grupos = new Map<string, { motivo: string; ajustes: number; unidades: number; valor: number }>();
    for (const a of ajustes) {
      const g = grupos.get(a.motivo) ?? { motivo: a.motivo, ajustes: 0, unidades: 0, valor: 0 };
      g.ajustes++;
      g.unidades += Math.abs(a.cantidad);
      g.valor += Math.abs(movs.filter((m) => m.documentoId === a.id).reduce((s, m) => s + Number(m.valor), 0));
      grupos.set(a.motivo, g);
    }
    const lista = [...grupos.values()].sort((a, b) => b.valor - a.valor);
    const total = lista.reduce((s, g) => s + g.valor, 0);
    let acumulado = 0;
    return {
      almacen: almacenParam ? plantas[0].codigo : null,
      desde: desde ?? null,
      hasta: hasta ?? null,
      total: r2(total),
      motivos: lista.map((g) => {
        acumulado += g.valor;
        return { ...g, valor: r2(g.valor), porcentaje: total ? r2((g.valor / total) * 100) : 0, porcentajeAcumulado: total ? r2((acumulado / total) * 100) : 0 };
      }),
    };
  }
}
