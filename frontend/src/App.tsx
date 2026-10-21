import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout, RequiereRol } from './diseno/Layout'
import { Proximamente } from './paginas/Proximamente'
import { Tablero } from './paginas/tablero/Tablero'
import { SECCIONES } from './sesion/permisos'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/tablero" replace />} />
        {SECCIONES.map((s) => (
          <Route key={s.ruta} path={s.ruta} element={<RequiereRol roles={s.roles}>{s.ruta === '/tablero' ? <Tablero /> : <Proximamente seccion={s} />}</RequiereRol>} />
        ))}
        <Route
          path="/articulos/:codigo"
          element={
            <RequiereRol roles={SECCIONES.find((s) => s.ruta === '/articulos')!.roles}>
              <Proximamente seccion={SECCIONES.find((s) => s.ruta === '/articulos')!} />
            </RequiereRol>
          }
        />
        <Route path="*" element={<Navigate to="/tablero" replace />} />
      </Route>
    </Routes>
  )
}
