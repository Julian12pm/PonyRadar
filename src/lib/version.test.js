import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
  INTERVALO_REVISION,
  recargarAlCambiarServiceWorker,
  revisarVersion,
  vigilarVersion,
} from './version.js'

const registroFalso = (cambios = {}) => ({
  installing: null,
  update: vi.fn(async () => {}),
  ...cambios,
})
const responde = (status) => vi.fn(async () => ({ status }))

describe('revisarVersion', () => {
  it('pide el service worker sin caché y luego revisa si cambió', async () => {
    const registro = registroFalso()
    const fetchFn = responde(200)
    expect(await revisarVersion(registro, '/sw.js', { fetchFn })).toBe(true)
    expect(fetchFn).toHaveBeenCalledWith('/sw.js', expect.objectContaining({ cache: 'no-store' }))
    expect(registro.update).toHaveBeenCalled()
  })

  it('no revisa sin red, mientras se instala otro o si el servidor no responde bien', async () => {
    const registro = registroFalso()
    expect(
      await revisarVersion(registro, '/sw.js', { fetchFn: responde(200), enLinea: false }),
    ).toBe(false)
    expect(
      await revisarVersion(registroFalso({ installing: {} }), '/sw.js', { fetchFn: responde(200) }),
    ).toBe(false)
    expect(await revisarVersion(registro, '/sw.js', { fetchFn: responde(404) })).toBe(false)
    const sinRed = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await revisarVersion(registro, '/sw.js', { fetchFn: sinRed })).toBe(false)
    expect(registro.update).not.toHaveBeenCalled()
  })
})

describe('vigilarVersion', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const entorno = () => {
    const ventana = new EventTarget()
    ventana.navigator = { onLine: true }
    const documento = new EventTarget()
    documento.visibilityState = 'hidden'
    return { ventana, documento }
  }

  it('revisa cada hora, al volver a la app y al regresar la red; y se puede detener', async () => {
    const registro = registroFalso()
    const fetchFn = responde(200)
    const { ventana, documento } = entorno()
    const dejar = vigilarVersion(registro, '/sw.js', { ventana, documento, fetchFn })

    await vi.advanceTimersByTimeAsync(INTERVALO_REVISION)
    expect(registro.update).toHaveBeenCalledTimes(1)

    // El celular trae la app del fondo
    documento.visibilityState = 'visible'
    documento.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(registro.update).toHaveBeenCalledTimes(2)

    // Ocultarla no revisa
    documento.visibilityState = 'hidden'
    documento.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(registro.update).toHaveBeenCalledTimes(2)

    ventana.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(registro.update).toHaveBeenCalledTimes(3)

    dejar()
    await vi.advanceTimersByTimeAsync(INTERVALO_REVISION * 2)
    ventana.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(registro.update).toHaveBeenCalledTimes(3)
  })
})

describe('recargarAlCambiarServiceWorker', () => {
  it('recarga una sola vez cuando el service worker nuevo toma el control', () => {
    const sw = new EventTarget()
    const recargar = vi.fn()
    recargarAlCambiarServiceWorker(sw, recargar)
    expect(recargar).not.toHaveBeenCalled()
    sw.dispatchEvent(new Event('controllerchange'))
    sw.dispatchEvent(new Event('controllerchange'))
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('sin service worker (navegador viejo) no hace nada', () => {
    expect(() => recargarAlCambiarServiceWorker(undefined, vi.fn())).not.toThrow()
  })
})
