// Cronograma de preparación de una fiesta (sección 8.2 del documento del sistema), con su estado según la fecha simulada.

export type EstadoHito = 'PASADO' | 'EN_CURSO' | 'PROXIMO';

export interface Hito {
  clave: string;
  titulo: string;
  desde: string;
  hasta: string;
  estado: EstadoHito;
  responsables: string[];
  accion: string;
}

const MS_DIA = 86_400_000;
const masDias = (f: Date, n: number) => new Date(f.getTime() + n * MS_DIA);
const dia = (f: Date) => f.toISOString().slice(0, 10);

export function cronogramaFiesta(f: { fechaInicio: Date; fechaFin: Date; semanasPreparacion: number }, fecha: Date): Hito[] {
  const antes = (dias: number) => masDias(f.fechaInicio, -dias);
  const despues = (dias: number) => masDias(f.fechaFin, dias);
  const definicion: { clave: string; titulo: string; desde: Date; hasta?: Date; responsables: string[]; accion: string }[] = [
    { clave: 'preparacion', titulo: `Inicio de la preparación (${f.semanasPreparacion} semanas antes)`, desde: antes(f.semanasPreparacion * 7), responsables: ['R07'], accion: 'Calcular el pronóstico de la fiesta, subir ROP, Q y Máx con el factor f y coordinar la producción con la planta.' },
    { clave: '4-semanas', titulo: '4 semanas antes', desde: antes(28), responsables: ['R02'], accion: 'Proponer promociones festivas (descuento o bonificación) con vigencia y tope.' },
    { clave: '3-semanas', titulo: '3 semanas antes', desde: antes(21), responsables: ['R06', 'R07'], accion: 'Revisar vencimientos: no pre-posicionar mercadería con menos de 60 días de vida restante.' },
    { clave: '2-semanas', titulo: '2 semanas antes', desde: antes(14), responsables: ['R07', 'R06'], accion: 'Activar AL14, emitir traslados extraordinarios y asegurar envases retornables.' },
    { clave: '1-semana', titulo: '1 semana antes', desde: antes(7), responsables: ['R06'], accion: 'Despacho anticipado antes de los feriados.' },
    { clave: 'durante', titulo: 'Durante la fiesta', desde: f.fechaInicio, hasta: f.fechaFin, responsables: ['R07', 'R02'], accion: 'Revisión diaria de alertas y reparto del stock si la cobertura baja de 2 días.' },
    { clave: '1-semana-despues', titulo: '1 semana después', desde: despues(7), responsables: ['R06', 'R07'], accion: 'Recuperar envases, contar la clase A y devolver el ROP a su valor base.' },
    { clave: '2-semanas-despues', titulo: '2 semanas después', desde: despues(14), responsables: ['R07', 'R02'], accion: 'Promoción de rotación del exceso, Pareto de faltantes y ajuste del factor f.' },
  ];
  const orden = [...definicion].sort((a, b) => a.desde.getTime() - b.desde.getTime());
  return orden.map((h, i) => {
    // Cada hito dura hasta el día anterior al siguiente (al menos su propio día); el último, una semana.
    const siguiente = orden[i + 1];
    const hasta = h.hasta ?? (siguiente && siguiente.desde > h.desde ? masDias(siguiente.desde, -1) : siguiente ? h.desde : masDias(h.desde, 6));
    const estado: EstadoHito = fecha < h.desde ? 'PROXIMO' : fecha > hasta ? 'PASADO' : 'EN_CURSO';
    return { clave: h.clave, titulo: h.titulo, desde: dia(h.desde), hasta: dia(hasta), estado, responsables: h.responsables, accion: h.accion };
  });
}
