import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout, RequiereRol } from './diseno/Layout'
import { Esqueleto } from './componentes/Tarjeta'
import { Proximamente } from './paginas/Proximamente'
import { SECCIONES } from './sesion/permisos'

// Cada pantalla se carga al visitarla (recharts y los formularios quedan fuera del paquete inicial).
const Tablero = lazy(() => import('./paginas/tablero/Tablero').then((m) => ({ default: m.Tablero })))
const Ficha = lazy(() => import('./paginas/articulos/Ficha').then((m) => ({ default: m.Ficha })))
// Pantallas construidas; el resto de las secciones muestra «Próximamente».
const PANTALLAS: Record<string, React.ComponentType> = {
  '/tablero': Tablero,
  '/alertas': lazy(() => import('./paginas/alertas/CentroAlertas').then((m) => ({ default: m.CentroAlertas }))),
  '/articulos': lazy(() => import('./paginas/articulos/Articulos').then((m) => ({ default: m.Articulos }))),
  '/operaciones': lazy(() => import('./paginas/operaciones/Operaciones').then((m) => ({ default: m.Operaciones }))),
  '/aprobaciones': lazy(() => import('./paginas/aprobaciones/Aprobaciones').then((m) => ({ default: m.Aprobaciones }))),
  '/analisis': lazy(() => import('./paginas/analisis/Analisis').then((m) => ({ default: m.Analisis }))),
  '/fiestas': lazy(() => import('./paginas/fiestas/Fiestas').then((m) => ({ default: m.Fiestas }))),
  '/costos': lazy(() => import('./paginas/costos/Costos').then((m) => ({ default: m.Costos }))),
  '/administracion': lazy(() => import('./paginas/administracion/Administracion').then((m) => ({ default: m.Administracion }))),
}
const cargando = <Esqueleto className="h-64 w-full" />

export default function App() {
  const articulos = SECCIONES.find((s) => s.ruta === '/articulos')!
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/tablero" replace />} />
        {SECCIONES.map((s) => {
          const Pantalla = PANTALLAS[s.ruta]
          return <Route key={s.ruta} path={s.ruta} element={<RequiereRol roles={s.roles}><Suspense fallback={cargando}>{Pantalla ? <Pantalla /> : <Proximamente seccion={s} />}</Suspense></RequiereRol>} />
        })}
        <Route
          path="/articulos/:codigo"
          element={
            <RequiereRol roles={articulos.roles}>
              <Suspense fallback={cargando}>
                <Ficha />
              </Suspense>
            </RequiereRol>
          }
        />
        <Route path="*" element={<Navigate to="/tablero" replace />} />
      </Route>
    </Routes>
  )
}
