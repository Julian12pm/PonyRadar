// Datos del mapa (pines y puntos seguros) resistentes a caídas de red o de Supabase:
//   · Arranca con la última copia local para que el mapa nunca quede vacío.
//   · Si la carga falla, avisa ("sin conexión") y reintenta con espera creciente.
//   · Si el tiempo real se desconecta, se vuelve a suscribir solo y recarga al volver.
import { useCallback, useEffect, useRef, useState } from 'react'
import { esperaReintento, guardarLocal, leerLocal } from './conexion.js'
import {
  aplicarCambio,
  cargarPines,
  cargarPuntosSeguros,
  escucharPines,
  seVeEnMapa,
} from './pines.js'

export const CLAVE_PINES = 'ponyradar:pines'

/** Pines de la copia local que todavía se verían en el mapa (descarta los ya caducados). */
export function pinesGuardados(ahora = new Date()) {
  const copia = leerLocal(CLAVE_PINES)
  if (!Array.isArray(copia?.valor)) return []
  return copia.valor.filter((p) => seVeEnMapa(p, ahora))
}

/**
 * @returns {{
 *   pines: object[], seguros: object[],
 *   enLinea: boolean,           false mientras no hay conexión con el servidor
 *   reintentar: () => void,      vuelve a cargar ya, sin esperar
 *   sinConexion: () => void,     avisa que una acción falló por red (activa los reintentos)
 * }}
 */
export function useDatosDelMapa() {
  const [pines, setPines] = useState(() => pinesGuardados())
  const [seguros, setSeguros] = useState([])
  const [enLinea, setEnLinea] = useState(() => globalThis.navigator?.onLine !== false)
  const intento = useRef(0)
  const temporizador = useRef(null)
  const montado = useRef(true)
  // Referencia a cargar(): el reintento programado la llama sin depender de sí misma
  const cargarRef = useRef(null)
  const programarReintento = useCallback(() => {
    clearTimeout(temporizador.current)
    const espera = esperaReintento(intento.current, { azar: Math.random() })
    intento.current += 1
    temporizador.current = setTimeout(() => cargarRef.current?.(), espera)
  }, [])

  const cargar = useCallback(async () => {
    clearTimeout(temporizador.current)
    try {
      const [lista, puntos] = await Promise.all([cargarPines(), cargarPuntosSeguros()])
      if (!montado.current) return
      setPines(lista)
      setSeguros(puntos)
      guardarLocal(CLAVE_PINES, lista)
      intento.current = 0
      setEnLinea(true)
    } catch {
      if (!montado.current) return
      // Cualquier falla al cargar se trata como falta de conexión: se reintenta más tarde
      setEnLinea(false)
      programarReintento()
    }
  }, [programarReintento])

  useEffect(() => {
    cargarRef.current = cargar
  }, [cargar])

  const sinConexion = useCallback(() => {
    setEnLinea(false)
    programarReintento()
  }, [programarReintento])

  // Carga inicial, tiempo real con reconexión y eventos del navegador
  useEffect(() => {
    montado.current = true
    // Primera carga en el siguiente ciclo (se cancela si el componente se desmonta antes)
    temporizador.current = setTimeout(cargar, 0)

    // Cada suscripción tiene un número; los avisos de una suscripción vieja se ignoran
    let generacion = 0
    let dejarDeEscuchar = () => {}
    let intentoCanal = 0
    let esperaCanal = null
    let seCayo = false

    const suscribir = () => {
      const esta = ++generacion
      dejarDeEscuchar = escucharPines(
        (pin) => setPines((anteriores) => aplicarCambio(anteriores, pin)),
        (estado) => {
          if (esta !== generacion || !montado.current) return
          if (estado === 'conectado') {
            intentoCanal = 0
            // Al volver, se recarga todo por si hubo cambios mientras estaba desconectado
            if (seCayo) {
              seCayo = false
              cargar()
            }
          } else if (!esperaCanal) {
            seCayo = true
            esperaCanal = setTimeout(() => {
              esperaCanal = null
              dejarDeEscuchar()
              suscribir()
            }, esperaReintento(intentoCanal++))
          }
        },
      )
    }
    suscribir()

    const alVolverInternet = () => cargar()
    const alPerderInternet = () => setEnLinea(false)
    window.addEventListener('online', alVolverInternet)
    window.addEventListener('offline', alPerderInternet)

    return () => {
      montado.current = false
      generacion++
      clearTimeout(temporizador.current)
      clearTimeout(esperaCanal)
      dejarDeEscuchar()
      window.removeEventListener('online', alVolverInternet)
      window.removeEventListener('offline', alPerderInternet)
    }
  }, [cargar])

  return { pines, seguros, enLinea, reintentar: cargar, sinConexion }
}
