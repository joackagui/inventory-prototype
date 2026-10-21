import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { fijarUsuarioApi } from '../api/cliente'

// 'TODOS' o el código de una planta (los códigos vienen de GET /api/almacenes).
export type FiltroAlmacen = string
export type Tema = 'claro' | 'oscuro'

interface ValorSesion {
  usuario: string
  fijarUsuario: (codigo: string) => void
  almacen: FiltroAlmacen
  fijarAlmacen: (almacen: FiltroAlmacen) => void
  tema: Tema
  alternarTema: () => void
  presentacion: boolean
  alternarPresentacion: () => void
}

// Preferencias del espectador: localStorage puede fallar (ventana privada), así que siempre hay un valor por defecto.
const leer = <T extends string>(clave: string, defecto: T): T => {
  try {
    return (localStorage.getItem(clave) as T | null) ?? defecto
  } catch {
    return defecto
  }
}
const guardar = (clave: string, valor: string) => {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    /* sin almacenamiento: la preferencia dura solo esta visita */
  }
}

const Contexto = createContext<ValorSesion | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<string>(() => {
    const inicial = leer('cbn.usuario', 'LOG-01')
    fijarUsuarioApi(inicial)
    return inicial
  })
  const [almacen, setAlmacen] = useState(() => leer<FiltroAlmacen>('cbn.almacen', 'TODOS'))
  const [tema, setTema] = useState(() => leer<Tema>('cbn.tema', 'claro'))
  const [presentacion, setPresentacion] = useState(() => leer<string>('cbn.presentacion', 'no') === 'si')

  useEffect(() => {
    document.documentElement.dataset.theme = tema
  }, [tema])
  useEffect(() => {
    if (presentacion) document.documentElement.dataset.presentacion = ''
    else delete document.documentElement.dataset.presentacion
  }, [presentacion])

  const fijarUsuario = useCallback((codigo: string) => {
    fijarUsuarioApi(codigo)
    guardar('cbn.usuario', codigo)
    setUsuario(codigo)
  }, [])
  const fijarAlmacen = useCallback((a: FiltroAlmacen) => {
    guardar('cbn.almacen', a)
    setAlmacen(a)
  }, [])
  const alternarTema = useCallback(() => {
    setTema((t) => {
      const nuevo = t === 'claro' ? 'oscuro' : 'claro'
      guardar('cbn.tema', nuevo)
      return nuevo
    })
  }, [])

  const alternarPresentacion = useCallback(() => {
    setPresentacion((p) => {
      guardar('cbn.presentacion', p ? 'no' : 'si')
      return !p
    })
  }, [])

  return <Contexto.Provider value={{ usuario, fijarUsuario, almacen, fijarAlmacen, tema, alternarTema, presentacion, alternarPresentacion }}>{children}</Contexto.Provider>
}

export function useSesion() {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useSesion fuera de SesionProvider')
  return valor
}
