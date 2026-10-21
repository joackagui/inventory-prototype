import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout, RequiereRol } from './diseno/Layout'
import { CentroAlertas } from './paginas/alertas/CentroAlertas'
import { Administracion } from './paginas/administracion/Administracion'
import { Analisis } from './paginas/analisis/Analisis'
import { Aprobaciones } from './paginas/aprobaciones/Aprobaciones'
import { Costos } from './paginas/costos/Costos'
import { Fiestas } from './paginas/fiestas/Fiestas'
import { Operaciones } from './paginas/operaciones/Operaciones'
import { Articulos } from './paginas/articulos/Articulos'
import { Ficha } from './paginas/articulos/Ficha'
import { Proximamente } from './paginas/Proximamente'
import { Tablero } from './paginas/tablero/Tablero'
import { SECCIONES } from './sesion/permisos'

// Pantallas construidas; el resto de las secciones muestra «Próximamente».
const PANTALLAS: Record<string, () => React.JSX.Element> = { '/tablero': Tablero, '/alertas': CentroAlertas, '/articulos': Articulos, '/operaciones': Operaciones, '/aprobaciones': Aprobaciones, '/analisis': Analisis, '/fiestas': Fiestas, '/costos': Costos, '/administracion': Administracion }

export default function App() {
  const articulos = SECCIONES.find((s) => s.ruta === '/articulos')!
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/tablero" replace />} />
        {SECCIONES.map((s) => {
          const Pantalla = PANTALLAS[s.ruta]
          return <Route key={s.ruta} path={s.ruta} element={<RequiereRol roles={s.roles}>{Pantalla ? <Pantalla /> : <Proximamente seccion={s} />}</RequiereRol>} />
        })}
        <Route
          path="/articulos/:codigo"
          element={
            <RequiereRol roles={articulos.roles}>
              <Ficha />
            </RequiereRol>
          }
        />
        <Route path="*" element={<Navigate to="/tablero" replace />} />
      </Route>
    </Routes>
  )
}
