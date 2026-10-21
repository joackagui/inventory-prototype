// Formato regional de la app: números 1,260 · fechas dd/mm/aaaa · dinero USD con dos decimales.

const formateadores = new Map<number, Intl.NumberFormat>()
const formateador = (decimales: number) => {
  if (!formateadores.has(decimales)) {
    formateadores.set(decimales, new Intl.NumberFormat('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }))
  }
  return formateadores.get(decimales)!
}

export const numero = (n: number | null | undefined, decimales = 0) => (n == null || Number.isNaN(n) ? '—' : formateador(decimales).format(n))

export const dinero = (n: number | null | undefined) => (n == null ? '—' : `USD ${numero(n, 2)}`)

// Para ejes de gráficos: 16.5k, 1.2M.
export const compacto = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

export const porcentaje = (n: number | null | undefined, decimales = 1) => (n == null ? '—' : `${numero(n, decimales)}%`)

// Las fechas de la API son días (AAAA-MM-DD o ISO a medianoche UTC): se formatean sin pasar por la zona horaria local.
export const fecha = (valor: string | null | undefined) => {
  if (!valor) return '—'
  const [a, m, d] = valor.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export const fechaCorta = (valor: string) => fecha(valor).slice(0, 5)

export const antiguedad = (dias: number) => (dias <= 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${numero(dias)} días`)

// Decimales solo si el valor los tiene (fórmulas y umbrales: 17 → "17", 14.62 → "14.62").
export const decimal = (n: number | null | undefined) => (n == null ? '—' : numero(n, Number.isInteger(n) ? 0 : 2))
