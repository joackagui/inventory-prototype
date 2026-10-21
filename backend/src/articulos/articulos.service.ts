import { Injectable } from '@nestjs/common';
import { ErrorNegocio, noEncontrado } from '../comun/errores.js';
import { peorColor } from '../alertas/evaluadores.js';
import { ropFiesta, TIPOS_FISICOS, vidaRestanteDias } from '../inventario/calculos/formulas.js';
import { obtenerStock, resolverAlmacen } from '../inventario/stock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulacionService } from '../simulacion/simulacion.service.js';
import type { UsuarioSesion } from '../usuarios/autorizacion.js';
import type { KardexDto } from './articulos.dto.js';

const MS_DIA = 86_400_000;
const dia = (f: Date) => f.toISOString().slice(0, 10);
const VIGENTES = { in: ['ABIERTA', 'ATENDIDA'] as ('ABIERTA' | 'ATENDIDA')[] };
const FISICOS: readonly string[] = TIPOS_FISICOS;

@Injectable()
export class ArticulosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulacion: SimulacionService,
  ) {}

  private async articulo(codigo: string) {
    const a = await this.prisma.articulo.findUnique({ where: { codigo } });
    if (!a) throw noEncontrado(`El artículo ${codigo}`);
    return a;
  }

  private async plantas(almacenParam?: string) {
    if (!almacenParam) return this.prisma.almacen.findMany({ where: { tipo: 'PLANTA' }, orderBy: { id: 'asc' } });
    const a = await resolverAlmacen(this.prisma, almacenParam);
    if (a.tipo !== 'PLANTA') throw new ErrorNegocio(400, 'ALMACEN_INVALIDO', `${a.codigo} es un almacén de tránsito`);
    return [a];
  }

  // Tabla de artículos: estado por almacén (color de su alerta más grave), vendible total, cobertura mínima y alertas.
  async estado(u: UsuarioSesion) {
    const fecha = await this.simulacion.fechaOperacion();
    const diasMinimos = await this.simulacion.diasMinimosDespacho();
    const plantas = await this.plantas();
    const articulos = await this.prisma.articulo.findMany({ orderBy: { codigo: 'asc' }, include: { parametros: { where: { almacen: { codigo: 'CD-LP-01' } } } } });
    const stocks = new Map<number, Awaited<ReturnType<typeof obtenerStock>>>();
    for (const p of plantas) stocks.set(p.id, await obtenerStock(this.prisma, p.id, fecha, diasMinimos));
    const alertas = u.rolCodigo === 'R01' ? [] : await this.prisma.alerta.findMany({ where: { estado: VIGENTES, articuloId: { not: null } } });
    return articulos.map((a) => {
      const filas = plantas.map((p) => ({ almacen: p.codigo, s: stocks.get(p.id)!.find((x) => x.articuloId === a.id)! }));
      if (u.rolCodigo === 'R01') {
        return { codigo: a.codigo, descripcion: a.descripcion, familia: a.familia, almacenes: filas.map(({ almacen, s }) => ({ almacen, estado: s.vendible > 0 ? 'DISPONIBLE' : 'AGOTADO' })) };
      }
      const propias = alertas.filter((x) => x.articuloId === a.id);
      return {
        codigo: a.codigo,
        descripcion: a.descripcion,
        familia: a.familia,
        unidad: a.unidad,
        claseAbc: a.parametros[0]?.claseAbc ?? null,
        precio: Number(a.precio),
        vidaUtilDias: a.vidaUtilDias,
        esRetornable: a.esRetornable,
        vendibleTotal: filas.reduce((t, { s }) => t + Math.max(0, s.vendible), 0),
        coberturaMinimaDias: Math.min(...filas.map(({ s }) => s.coberturaDias)),
        alertasVigentes: propias.length,
        almacenes: filas.map(({ almacen, s }) => {
          const deEste = propias.filter((x) => x.almacenId === plantas.find((p) => p.codigo === almacen)!.id);
          return { almacen, color: peorColor(deEste.map((x) => x.color)), vendible: Math.max(0, s.vendible), coberturaDias: s.coberturaDias, alertas: [...new Set(deEste.map((x) => x.codigo))].sort() };
        }),
      };
    });
  }

  // Ficha: estados del stock, parámetros, costos FIFO y stock por función (seguridad, ciclo, tránsito, estacional).
  async resumen(codigo: string, almacenParam: string | undefined, u: UsuarioSesion) {
    const articulo = await this.articulo(codigo);
    const plantas = await this.plantas(almacenParam);
    const fecha = await this.simulacion.fechaOperacion();
    const diasMinimos = await this.simulacion.diasMinimosDespacho();
    const fiestas = await this.prisma.fiesta.findMany({ where: { fechaFin: { gte: fecha } }, orderBy: { fechaInicio: 'asc' } });
    const alertas = u.rolCodigo === 'R01' ? [] : await this.prisma.alerta.findMany({ where: { estado: VIGENTES, articuloId: articulo.id }, orderBy: { id: 'asc' } });
    const almacenes = [];
    for (const p of plantas) {
      const s = (await obtenerStock(this.prisma, p.id, fecha, diasMinimos)).find((x) => x.articuloId === articulo.id)!;
      if (u.rolCodigo === 'R01') {
        almacenes.push({ almacen: p.codigo, nombre: p.nombre, disponible: Math.max(0, s.vendible), vendible: Math.max(0, s.vendible), estado: s.vendible > 0 ? 'DISPONIBLE' : 'AGOTADO' });
        continue;
      }
      const par = await this.prisma.parametroArticuloAlmacen.findUniqueOrThrow({ where: { articuloId_almacenId: { articuloId: articulo.id, almacenId: p.id } } });
      const ultima = await this.prisma.capaFifo.findFirst({ where: { articuloId: articulo.id, almacenId: p.id }, orderBy: [{ fechaEntrada: 'desc' }, { id: 'desc' }] });
      // Próxima fiesta de la zona del almacén: el stock estacional es lo que el ROP de fiesta pide por encima del ROP base.
      const fiesta = fiestas.find((f) => f.zonas.includes(p.codigo));
      const rf = fiesta ? ropFiesta(par.demandaDiaria, fiesta.factor, par.leadTimeDias, par.stockSeguridad) : null;
      const seguridad = Math.min(Math.max(0, s.disponible), par.stockSeguridad);
      const propias = alertas.filter((a) => a.almacenId === p.id);
      almacenes.push({
        almacen: p.codigo,
        nombre: p.nombre,
        disponible: s.disponible,
        vendible: s.vendible,
        reservado: s.reservado,
        cuarentena: s.cuarentena,
        enTransito: s.enTransito,
        posicion: s.posicion,
        coberturaDias: s.coberturaDias,
        vidaRestanteDias: s.vidaRestanteDias,
        trasladoPropuesto: s.trasladoPropuesto,
        parametros: {
          demandaDiaria: par.demandaDiaria,
          desviacionDemanda: par.desviacionDemanda,
          leadTimeDias: par.leadTimeDias,
          claseAbc: par.claseAbc,
          nivelServicio: par.nivelServicio,
          z: par.z,
          diasRevision: par.diasRevision,
          stockSeguridad: par.stockSeguridad,
          rop: par.rop,
          loteTraslado: par.loteTraslado,
          stockMaximo: par.stockMaximo,
          ultimoConteo: par.ultimoConteo ? dia(par.ultimoConteo) : null,
        },
        costoFifoMasAntigua: s.costoFifo,
        costoUltimaCapa: ultima ? Number(ultima.costoUnitario) : null,
        funcion: {
          seguridad,
          ciclo: Math.max(0, s.disponible - seguridad),
          transito: s.enTransito,
          estacional: rf === null ? 0 : Math.max(0, rf - par.rop),
          fiesta: fiesta ? { nombre: fiesta.nombre, fechaInicio: dia(fiesta.fechaInicio), factor: fiesta.factor, ropFiesta: rf } : null,
        },
        color: peorColor(propias.map((a) => a.color)),
        alertas: propias.map((a) => ({ id: a.id, codigo: a.codigo, color: a.color, mensaje: a.mensaje, estado: a.estado })),
      });
    }
    const base = { codigo: articulo.codigo, descripcion: articulo.descripcion, familia: articulo.familia, unidad: articulo.unidad, esRetornable: articulo.esRetornable };
    if (u.rolCodigo === 'R01') return { articulo: base, fechaOperacion: dia(fecha), almacenes };
    return { articulo: { ...base, precio: Number(articulo.precio), vidaUtilDias: articulo.vidaUtilDias, costoFifoInicial: Number(articulo.costoFifoInicial) }, fechaOperacion: dia(fecha), almacenes };
  }

  // Stock físico al cierre de cada día (desde los movimientos) con SS, ROP y Máx para graficar.
  async serie(codigo: string, almacenParam: string, dias: number) {
    const articulo = await this.articulo(codigo);
    const [almacen] = await this.plantas(almacenParam);
    const fecha = await this.simulacion.fechaOperacion();
    const par = await this.prisma.parametroArticuloAlmacen.findUniqueOrThrow({ where: { articuloId_almacenId: { articuloId: articulo.id, almacenId: almacen.id } } });
    const movs = await this.prisma.movimiento.findMany({
      where: { articuloId: articulo.id, almacenId: almacen.id, tipo: { in: [...TIPOS_FISICOS] }, fechaOperacion: { lte: fecha } },
      select: { cantidad: true, fechaOperacion: true },
      orderBy: [{ fechaOperacion: 'asc' }, { id: 'asc' }],
    });
    const inicio = new Date(fecha.getTime() - (dias - 1) * MS_DIA);
    let i = 0;
    let saldo = 0;
    const puntos = [];
    for (let d = 0; d < dias; d++) {
      const cierre = new Date(inicio.getTime() + d * MS_DIA);
      for (; i < movs.length && movs[i].fechaOperacion <= cierre; i++) saldo += movs[i].cantidad;
      puntos.push({ fecha: dia(cierre), saldo, bajoRop: saldo <= par.rop });
    }
    return { articulo: codigo, almacen: almacen.codigo, stockSeguridad: par.stockSeguridad, rop: par.rop, stockMaximo: par.stockMaximo, puntos };
  }

  // Capas con saldo en orden FIFO; marca las no despachables (cuarentena o < N días de vida) y la próxima en salir de cada almacén.
  async capas(codigo: string) {
    const fecha = await this.simulacion.fechaOperacion();
    const diasMinimos = await this.simulacion.diasMinimosDespacho();
    const capas = await this.prisma.capaFifo.findMany({
      where: { articulo: { codigo }, cantidadRestante: { gt: 0 } },
      include: { almacen: { select: { codigo: true, tipo: true } }, ubicacion: { select: { codigo: true } } },
      orderBy: [{ almacenId: 'asc' }, { fechaEntrada: 'asc' }, { id: 'asc' }],
    });
    const proximas = new Set<number>();
    return capas.map((c) => {
      const vida = vidaRestanteDias(c.fechaVencimiento, fecha);
      const despachable = c.estado === 'DISPONIBLE' && c.almacen.tipo === 'PLANTA' && vida >= diasMinimos;
      const proximaEnSalir = despachable && !proximas.has(c.almacenId);
      if (proximaEnSalir) proximas.add(c.almacenId);
      const motivoNoDespachable = despachable ? null : c.estado === 'CUARENTENA' ? 'En cuarentena' : c.almacen.tipo !== 'PLANTA' ? 'En tránsito' : `Menos de ${diasMinimos} días de vida`;
      return { ...c, costoUnitario: Number(c.costoUnitario), vidaRestanteDias: vida, valor: Math.round(c.cantidadRestante * Number(c.costoUnitario) * 100) / 100, despachable, proximaEnSalir, motivoNoDespachable };
    });
  }

  // Kardex valorado: el saldo se acumula sobre toda la historia y luego se filtra y pagina (más reciente primero).
  async kardex(codigo: string, f: KardexDto) {
    const almacen = await resolverAlmacen(this.prisma, f.almacenId);
    const movimientos = await this.prisma.movimiento.findMany({
      where: { articulo: { codigo }, almacenId: almacen.id },
      include: { usuario: { select: { codigo: true } }, ubicacion: { select: { codigo: true } }, capa: { select: { lote: true } } },
      orderBy: [{ fechaOperacion: 'asc' }, { id: 'asc' }],
    });
    let saldo = 0;
    let saldoValor = 0;
    const filas = movimientos.map((m) => {
      if (FISICOS.includes(m.tipo)) {
        saldo += m.cantidad;
        saldoValor = Math.round((saldoValor + Number(m.valor)) * 100) / 100;
      }
      return {
        id: m.id,
        fechaOperacion: dia(m.fechaOperacion),
        tipo: m.tipo,
        fisico: FISICOS.includes(m.tipo),
        motivo: m.motivo,
        ubicacion: m.ubicacion.codigo,
        lote: m.capa?.lote ?? null,
        usuario: m.usuario.codigo,
        cantidad: m.cantidad,
        costoUnitario: Number(m.costoUnitario),
        valor: Number(m.valor),
        saldo,
        saldoValor,
      };
    });
    const filtradas = filas.filter((m) => (!f.tipo || m.tipo === f.tipo) && (!f.desde || m.fechaOperacion >= f.desde) && (!f.hasta || m.fechaOperacion <= f.hasta)).reverse();
    return { almacen: almacen.codigo, total: filtradas.length, pagina: f.pagina, tamano: f.tamano, datos: filtradas.slice((f.pagina - 1) * f.tamano, f.pagina * f.tamano) };
  }
}
