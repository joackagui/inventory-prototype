import { useQuery } from '@tanstack/react-query'

const API = 'http://localhost:3000/api'

type Salud = { estado: string; baseDeDatos: 'conectada' | 'sin conexión'; fechaSimulada: string | null }

export default function App() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['salud'],
    queryFn: async (): Promise<Salud> => {
      const res = await fetch(`${API}/salud`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    refetchInterval: 5000,
  })

  const bdOk = data?.baseDeDatos === 'conectada'

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <h1 className="text-2xl font-bold">Inventario CBN · Estado del sistema</h1>
      <div className="mt-6 max-w-md space-y-3 rounded-xl bg-white p-6 shadow">
        {isPending && <p>Consultando backend…</p>}
        {isError && <p className="font-semibold text-red-600">🔴 Backend sin respuesta (¿está corriendo en el puerto 3000?)</p>}
        {data && (
          <>
            <p>Backend: <span className="font-semibold text-green-600">🟢 {data.estado}</span></p>
            <p>
              Base de datos:{' '}
              <span className={`font-semibold ${bdOk ? 'text-green-600' : 'text-red-600'}`}>
                {bdOk ? '🟢' : '🔴'} {data.baseDeDatos}
              </span>
            </p>
            <p>Fecha simulada: <span className="font-semibold">{data.fechaSimulada ?? 'sin definir'}</span></p>
          </>
        )}
      </div>
    </main>
  )
}
