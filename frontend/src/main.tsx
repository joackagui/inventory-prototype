import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { describirError } from './api/cliente'
import App from './App'
import './index.css'
import { SesionProvider, useSesion } from './sesion/Sesion'

// Errores de la API en un solo lugar, con aviso en español (el id evita avisos repetidos).
const avisar = (e: unknown) => toast.error(describirError(e), { id: describirError(e) })
// Las mutaciones con meta.silencioso muestran el error dentro de su formulario (por ejemplo, el faltante de un pedido).
const clienteConsultas: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e, consulta) => !consulta.meta?.silencioso && avisar(e) }),
  mutationCache: new MutationCache({
    onError: (e, _v, _c, mutacion) => !mutacion.meta?.silencioso && avisar(e),
    // Cualquier operación puede cambiar stock y alertas: se refrescan todas las consultas.
    onSuccess: (): Promise<void> => clienteConsultas.invalidateQueries(),
  }),
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
})

function Avisos() {
  const { tema } = useSesion()
  return <Toaster richColors closeButton position="bottom-right" theme={tema === 'oscuro' ? 'dark' : 'light'} toastOptions={{ style: { fontSize: '0.95rem' } }} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={clienteConsultas}>
      <SesionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Avisos />
      </SesionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
