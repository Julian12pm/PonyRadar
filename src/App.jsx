// Punto de entrada de las pantallas: sin sesión muestra el inicio de sesión; con sesión, el mapa.
import { configurado } from './lib/supabase.js'
import { useSesion } from './lib/sesion.js'
import Login from './paginas/Login.jsx'
import Mapa from './paginas/Mapa.jsx'

function Sesion() {
  const { cargando, sesion, perfil } = useSesion()
  if (cargando) {
    return (
      <main className="grid h-full place-items-center bg-fondo">
        <p className="text-2xl font-extrabold">PonyRadar</p>
      </main>
    )
  }
  return sesion ? <Mapa perfil={perfil} /> : <Login />
}

export default function App() {
  if (!configurado) {
    return (
      <main className="grid h-full place-items-center bg-fondo p-6 text-center">
        <div className="tarjeta max-w-sm p-5">
          <h1 className="text-2xl font-extrabold">PonyRadar</h1>
          <p className="mt-2">
            Falta configurar Supabase: copia <code>.env.example</code> como <code>.env.local</code>{' '}
            y llena sus valores.
          </p>
        </div>
      </main>
    )
  }
  return <Sesion />
}
