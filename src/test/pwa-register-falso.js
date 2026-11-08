// En las pruebas no existe el módulo virtual de vite-plugin-pwa: este lo reemplaza
// (ver test.alias en vite.config.js). Cada prueba puede simularlo con vi.mock.
import { useState } from 'react'

export function useRegisterSW() {
  const needRefresh = useState(false)
  const offlineReady = useState(false)
  return { needRefresh, offlineReady, updateServiceWorker: async () => {} }
}
