import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// Simulación de pines.js: cada prueba decide si el servidor responde o falla
const servidor = vi.hoisted(() => ({
  cargarPines: vi.fn(),
  cargarPuntosSeguros: vi.fn(async () => []),
  avisosDeEstado: [],
  suscripciones: 0,
}))
vi.mock('./pines.js', async (original) => ({
  ...(await original()),
  cargarPines: servidor.cargarPines,
  cargarPuntosSeguros: servidor.cargarPuntosSeguros,
  escucharPines: (_alCambiar, alEstado) => {
    servidor.suscripciones += 1
    servidor.avisosDeEstado.push(alEstado)
    return () => {}
  },
}))

const { CLAVE_PINES, useDatosDelMapa } = await import('./useDatosDelMapa.js')

const falloDeRed = () => Promise.reject(new TypeError('Failed to fetch'))
const enUnDia = new Date(Date.now() + 86400000).toISOString()
const pin = (id) => ({ id, tipo: 'rojo', estado: 'activo', expira: enUnDia, punto: [0, 0] })

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  servidor.cargarPines.mockReset()
  servidor.avisosDeEstado.length = 0
  servidor.suscripciones = 0
})
afterEach(() => vi.useRealTimers())

/** Deja correr el reloj simulado (y las promesas pendientes). */
const esperar = (ms) => act(() => vi.advanceTimersByTimeAsync(ms))

describe('useDatosDelMapa ante fallas de red', () => {
  it('carga los pines, queda en línea y guarda una copia local', async () => {
    servidor.cargarPines.mockResolvedValue([pin('a')])
    const { result } = renderHook(() => useDatosDelMapa())
    await esperar(0)
    expect(result.current.enLinea).toBe(true)
    expect(result.current.pines.map((p) => p.id)).toEqual(['a'])
    expect(JSON.parse(localStorage.getItem(CLAVE_PINES)).valor).toHaveLength(1)
  })

  it('si el servidor no responde, muestra la copia local y reintenta con espera creciente', async () => {
    localStorage.setItem(CLAVE_PINES, JSON.stringify({ guardado: '', valor: [pin('guardado')] }))
    servidor.cargarPines.mockImplementation(falloDeRed)
    const { result } = renderHook(() => useDatosDelMapa())

    // Mientras tanto se ven los últimos pines guardados
    expect(result.current.pines.map((p) => p.id)).toEqual(['guardado'])
    await esperar(0)
    expect(result.current.enLinea).toBe(false)
    expect(servidor.cargarPines).toHaveBeenCalledTimes(1)

    // 1.er reintento a ~1 s, 2.º a ~2 s más, 3.º a ~4 s más (hasta 20 % de variación)
    await esperar(1300)
    expect(servidor.cargarPines).toHaveBeenCalledTimes(2)
    await esperar(1500)
    expect(servidor.cargarPines).toHaveBeenCalledTimes(2) // todavía no: la espera creció
    await esperar(1100)
    expect(servidor.cargarPines).toHaveBeenCalledTimes(3)

    // Vuelve el servidor: se recupera solo
    servidor.cargarPines.mockResolvedValue([pin('nuevo')])
    await esperar(5000)
    expect(result.current.enLinea).toBe(true)
    expect(result.current.pines.map((p) => p.id)).toEqual(['nuevo'])
  })

  it('descarta de la copia local los pines que ya caducaron', async () => {
    const caducado = { ...pin('viejo'), expira: '2020-01-01T00:00:00Z' }
    localStorage.setItem(
      CLAVE_PINES,
      JSON.stringify({ guardado: '', valor: [caducado, pin('ok')] }),
    )
    servidor.cargarPines.mockImplementation(falloDeRed)
    const { result } = renderHook(() => useDatosDelMapa())
    expect(result.current.pines.map((p) => p.id)).toEqual(['ok'])
  })

  it('si el tiempo real se cae, se vuelve a suscribir solo y recarga los pines al volver', async () => {
    servidor.cargarPines.mockResolvedValue([pin('a')])
    renderHook(() => useDatosDelMapa())
    await esperar(0)
    expect(servidor.suscripciones).toBe(1)
    act(() => servidor.avisosDeEstado[0]('conectado'))
    const cargasAntes = servidor.cargarPines.mock.calls.length

    act(() => servidor.avisosDeEstado[0]('desconectado'))
    await esperar(1100)
    expect(servidor.suscripciones).toBe(2) // nueva suscripción tras la espera

    // La suscripción nueva se conecta: se recargan los pines
    act(() => servidor.avisosDeEstado[1]('conectado'))
    await esperar(0)
    expect(servidor.cargarPines.mock.calls.length).toBe(cargasAntes + 1)

    // Avisos de la suscripción vieja ya no hacen nada
    act(() => servidor.avisosDeEstado[0]('desconectado'))
    await esperar(5000)
    expect(servidor.suscripciones).toBe(2)
  })

  it('reacciona a perder y recuperar el internet del dispositivo', async () => {
    servidor.cargarPines.mockResolvedValue([pin('a')])
    const { result } = renderHook(() => useDatosDelMapa())
    await esperar(0)

    act(() => window.dispatchEvent(new Event('offline')))
    expect(result.current.enLinea).toBe(false)

    act(() => window.dispatchEvent(new Event('online')))
    await esperar(0)
    expect(result.current.enLinea).toBe(true)
  })

  it('sinConexion() activa el modo sin conexión y programa un reintento', async () => {
    servidor.cargarPines.mockResolvedValue([pin('a')])
    const { result } = renderHook(() => useDatosDelMapa())
    await esperar(0)
    const cargas = servidor.cargarPines.mock.calls.length

    act(() => result.current.sinConexion())
    expect(result.current.enLinea).toBe(false)
    await esperar(1300)
    expect(servidor.cargarPines.mock.calls.length).toBe(cargas + 1)
    expect(result.current.enLinea).toBe(true)
  })
})
