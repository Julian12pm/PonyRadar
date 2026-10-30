// Punto de entrada de las pantallas: sin sesión muestra el inicio de sesión; con sesión,
// el mapa ("/"), "Mis casos" ("/casos"), las listas "Se busca" / "En resguardo" ("/listas")
// y los paneles del punto seguro ("/punto") y del admin ("/admin"). Los avisos se escuchan aquí para que el contador
// se vea en las dos pantallas.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AvisoVersion from './componentes/AvisoVersion.jsx'
import { configurado } from './lib/supabase.js'
import { useSesion } from './lib/sesion.js'
import { useAvisos } from './lib/useAvisos.js'
import Listas from './paginas/Listas.jsx'
import Login from './paginas/Login.jsx'
import Mapa from './paginas/Mapa.jsx'
import MisCasos from './paginas/MisCasos.jsx'
import PanelAdmin from './paginas/PanelAdmin.jsx'
import PanelPunto from './paginas/PanelPunto.jsx'

function Pantallas({ sesion, perfil }) {
  const avisos = useAvisos(sesion.user?.id)
  return (
    <Routes>
      <Route path="/" element={<Mapa perfil={perfil} avisos={avisos} />} />
      <Route path="/casos" element={<MisCasos perfil={perfil} avisos={avisos} />} />
      <Route path="/listas" element={<Listas perfil={perfil} />} />
      <Route path="/punto" element={<PanelPunto perfil={perfil} avisos={avisos} />} />
      <Route path="/admin" element={<PanelAdmin perfil={perfil} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function Sesion() {
  const { cargando, sesion, perfil } = useSesion()
  if (cargando) {
    return (
      <main className="grid h-full place-items-center bg-fondo">
        <p className="text-2xl font-extrabold">PonyRadar</p>
      </main>
    )
  }
  return sesion ? <Pantallas sesion={sesion} perfil={perfil} /> : <Login />
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
  return (
    <BrowserRouter>
      <Sesion />
      {/* Aviso de versión nueva de la app instalada, en todas las pantallas */}
      <AvisoVersion />
    </BrowserRouter>
  )
}
