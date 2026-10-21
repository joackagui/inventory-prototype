// Agrupación de códigos de alerta para los filtros del Centro de alertas (docs/ALERTAS.md).
export const FAMILIAS = [
  { clave: 'REPOSICION', nombre: 'Reposición', codigos: ['AL01', 'AL02', 'AL03'] },
  { clave: 'VENCIMIENTO', nombre: 'Vencimiento', codigos: ['AL04'] },
  { clave: 'CONTEO', nombre: 'Conteo y ajustes', codigos: ['AL05', 'AL06', 'AL07'] },
  { clave: 'TRASLADOS', nombre: 'Traslados', codigos: ['AL08', 'AL09'] },
  { clave: 'ENVASES', nombre: 'Envases', codigos: ['AL10'] },
  { clave: 'PEDIDOS', nombre: 'Pedidos y reservas', codigos: ['AL11', 'AL12'] },
  { clave: 'COSTOS', nombre: 'Costos', codigos: ['AL13'] },
  { clave: 'FIESTAS', nombre: 'Fiestas y promociones', codigos: ['AL14', 'AL15'] },
  { clave: 'INTEGRACION', nombre: 'Integración', codigos: ['AL16'] },
] as const

export type ClaveFamilia = (typeof FAMILIAS)[number]['clave']
