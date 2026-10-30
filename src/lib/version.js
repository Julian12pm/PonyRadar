// Busca si hay una versión nueva de la app instalada (PWA).
// El navegador solo revisa el service worker al navegar; una app que se queda abierta o que
// el celular trae del fondo puede pasar días sin revisar. Aquí se revisa cada hora, al volver
// a la app y al recuperar la red. Si hay versión nueva, AvisoVersion lo muestra.

export const INTERVALO_REVISION = 60 * 60 * 1000 // 1 hora

/**
 * Pide al servidor el service worker sin caché y, si responde, le dice al navegador que
 * revise si cambió. No hace nada si ya se está instalando uno o si no hay red.
 */
export async function revisarVersion(registro, urlSW, { fetchFn = fetch, enLinea = true } = {}) {
  if (!registro || registro.installing || !enLinea) return false
  try {
    const respuesta = await fetchFn(urlSW, {
      cache: 'no-store',
      headers: { cache: 'no-store', 'cache-control': 'no-cache' },
    })
    if (respuesta?.status !== 200) return false
    await registro.update()
    return true
  } catch {
    return false // sin red o servidor caído: se intentará la próxima vez
  }
}

/**
 * Revisa cada hora, cuando la app vuelve a estar a la vista y cuando regresa la red.
 * @returns {() => void} función para dejar de vigilar
 */
export function vigilarVersion(
  registro,
  urlSW,
  {
    ventana = globalThis.window,
    documento = globalThis.document,
    intervalo = INTERVALO_REVISION,
    fetchFn = globalThis.fetch?.bind(globalThis),
  } = {},
) {
  const revisar = () =>
    revisarVersion(registro, urlSW, { fetchFn, enLinea: ventana?.navigator?.onLine !== false })
  const alVolver = () => {
    if (documento?.visibilityState === 'visible') revisar()
  }
  const reloj = setInterval(revisar, intervalo)
  documento?.addEventListener('visibilitychange', alVolver)
  ventana?.addEventListener('online', revisar)
  return () => {
    clearInterval(reloj)
    documento?.removeEventListener('visibilitychange', alVolver)
    ventana?.removeEventListener('online', revisar)
  }
}

/**
 * Recarga la página una sola vez cuando el service worker nuevo toma el control. El plugin
 * solo recarga si Workbox marca el cambio como "actualización", y eso falla si el service
 * worker se instaló durante esta misma visita: sin esto, "Actualizar" a veces no recargaba.
 */
export function recargarAlCambiarServiceWorker(
  sw = globalThis.navigator?.serviceWorker,
  recargar = () => globalThis.location.reload(),
) {
  if (!sw) return
  let hecho = false
  sw.addEventListener(
    'controllerchange',
    () => {
      if (hecho) return
      hecho = true
      recargar()
    },
    { once: true },
  )
}
