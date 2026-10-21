import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LECTURA, Roles } from '../usuarios/autorizacion.js';
import { AlmacenOpcionalDto, CostosDto, ParetoDto } from './analisis.dto.js';
import { AnalisisService } from './analisis.service.js';

@ApiTags('Análisis')
@Roles(...LECTURA)
@Controller()
export class AnalisisController {
  constructor(private readonly servicio: AnalisisService) {}

  /** KPIs del tablero: valor del inventario, artículos por estado, alertas, cobertura, traslados, exactitud y ventas de 30 días hábiles. */
  @Get('tablero/resumen')
  tablero(@Query() q: AlmacenOpcionalDto) {
    return this.servicio.tablero(q.almacenId);
  }

  /** Costos del mes por artículo: adquisición, conservación, pedido y agotamiento, con las tasas usadas. */
  @Get('costos')
  costos(@Query() q: CostosDto) {
    return this.servicio.costos(q.almacenId, q.mes);
  }

  /** Preparación de fiestas: ventana, ROP/Q/Máx de fiesta, pronóstico, posición, brecha y estado por artículo. */
  @Get('fiestas/preparacion')
  fiestas(@Query() q: AlmacenOpcionalDto) {
    return this.servicio.preparacionFiestas(q.almacenId);
  }

  /** Pareto de ajustes y mermas aprobados por motivo (valor en USD, % y % acumulado). */
  @Get('analisis/pareto-ajustes')
  pareto(@Query() q: ParetoDto) {
    return this.servicio.paretoAjustes(q.almacenId, q.desde, q.hasta);
  }
}
