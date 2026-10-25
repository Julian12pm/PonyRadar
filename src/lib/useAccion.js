// Corre acciones del servidor desde un botón: estado "ocupado" y mensaje de error.
import { useState } from 'react'

/** Corre una acción del servidor mostrando "ocupado" y el error, si lo hay. */
export function useAccion(alTerminar) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const correr = async (accion) => {
    setOcupado(true)
    setError(null)
    try {
      const resultado = await accion()
      alTerminar?.()
      return resultado
    } catch (e) {
      setError(e.message)
      return undefined
    } finally {
      setOcupado(false)
    }
  }
  return { ocupado, error, correr }
}
