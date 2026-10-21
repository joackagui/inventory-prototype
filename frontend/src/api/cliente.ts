// Cliente HTTP de la API: agrega X-Usuario y convierte los errores { codigo, mensaje, detalles } en ErrorApi.

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export class ErrorApi extends Error {
  readonly status: number
  readonly codigo: string
  readonly detalles: unknown
  constructor(status: number, codigo: string, mensaje: string, detalles: unknown) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
    this.detalles = detalles
  }
}

let usuarioActual: string | null = null
export const fijarUsuarioApi = (codigo: string | null) => {
  usuarioActual = codigo
}

export async function api<T>(ruta: string, opciones: { metodo?: 'GET' | 'POST' | 'PUT'; cuerpo?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(usuarioActual ? { 'X-Usuario': usuarioActual } : {}) },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    })
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con el backend (¿está corriendo en el puerto 3000?)', null)
  }
  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) throw new ErrorApi(res.status, cuerpo?.codigo ?? 'ERROR', cuerpo?.mensaje ?? `Error ${res.status}`, cuerpo?.detalles ?? null)
  return cuerpo as T
}

export function describirError(e: unknown) {
  if (!(e instanceof ErrorApi)) return 'Ocurrió un error inesperado'
  return Array.isArray(e.detalles) && e.detalles.length ? `${e.message}: ${e.detalles.join('; ')}` : e.message
}
