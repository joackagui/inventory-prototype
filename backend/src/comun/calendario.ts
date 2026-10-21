// Días de despacho del canal de preventa: lunes a sábado, sin feriados nacionales (24 días en junio de 2027, como el documento).
const FERIADOS = new Set(['2027-01-01', '2027-01-22', '2027-02-08', '2027-02-09', '2027-03-26', '2027-05-01', '2027-05-27', '2027-06-21', '2027-08-06', '2027-11-02', '2027-12-25']);

export const esDiaDespacho = (f: Date) => f.getUTCDay() !== 0 && !FERIADOS.has(f.toISOString().slice(0, 10));
