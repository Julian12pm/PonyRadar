// Avisos dentro de la app: los carga al iniciar sesión y escucha los nuevos en tiempo real.
// "version" sube con cada aviso nuevo para que "Mis casos" sepa que debe recargarse.
import { useCallback, useEffect, useState } from 'react'
import { cargarAvisos, escucharAvisos, marcarAvisosLeidos } from './casos.js'

/**
 * @param {string|undefined} yo id del usuario con sesión
 * @returns {{lista: object[], noLeidos: number, version: number, marcarLeidos: () => void}}
 */
export function useAvisos(yo) {
  const [avisos, setAvisos] = useState([])
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!yo) return undefined
    let vigente = true
    const recargar = () =>
      cargarAvisos()
        .then((lista) => vigente && setAvisos(lista))
        // Sin conexión los avisos simplemente no se actualizan; el mapa ya avisa de la falla
        .catch(() => {})
    recargar()
    const dejar = escucharAvisos(yo, () => {
      // El aviso en tiempo real llega sin el título del pin: se recarga la lista completa
      recargar()
      setVersion((v) => v + 1)
    })
    return () => {
      vigente = false
      dejar()
    }
  }, [yo])

  const marcarLeidos = useCallback(() => {
    const ids = avisos.filter((a) => !a.leido).map((a) => a.id)
    if (!ids.length) return
    // "nuevo" mantiene el resaltado mientras sigas en la pantalla, aunque ya cuenten como leídos
    setAvisos((lista) => lista.map((a) => (a.leido ? a : { ...a, leido: true, nuevo: true })))
    marcarAvisosLeidos(ids).catch(() => {})
  }, [avisos])

  return { lista: avisos, noLeidos: avisos.filter((a) => !a.leido).length, version, marcarLeidos }
}
