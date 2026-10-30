// Aviso "Hay una versión nueva" de la app instalada. "Actualizar" activa la versión nueva del
// service worker y recarga la app una sola vez (antes había que cerrarla y abrirla varias veces).
import { useRegisterSW } from 'virtual:pwa-register/react'
import { recargarAlCambiarServiceWorker, vigilarVersion } from '../lib/version.js'

export default function AvisoVersion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    // Con el registro listo, se empieza a revisar si hay versión nueva (dura toda la sesión)
    onRegisteredSW(urlSW, registro) {
      if (registro) vigilarVersion(registro, urlSW)
    },
  })

  if (!hayVersionNueva) return null
  return (
    <div role="status" className="aviso-version">
      <p className="flex-1 font-bold">Hay una versión nueva</p>
      <button type="button" className="enlace-accion" onClick={() => setHayVersionNueva(false)}>
        Ahora no
      </button>
      <button
        type="button"
        className="boton-chico bg-pin-verde px-3 text-white"
        onClick={() => {
          recargarAlCambiarServiceWorker()
          updateServiceWorker(true)
        }}
      >
        Actualizar
      </button>
    </div>
  )
}
