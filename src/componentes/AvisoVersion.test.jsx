import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

// Simulación del módulo de vite-plugin-pwa: cada prueba dice si hay versión nueva
const pwa = vi.hoisted(() => ({
  hayVersionNueva: false,
  updateServiceWorker: null,
  opciones: null,
}))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (opciones) => {
    pwa.opciones = opciones
    const needRefresh = useState(pwa.hayVersionNueva)
    const offlineReady = useState(false)
    return { needRefresh, offlineReady, updateServiceWorker: pwa.updateServiceWorker }
  },
}))
vi.mock('../lib/version.js', () => ({
  vigilarVersion: vi.fn(() => () => {}),
  recargarAlCambiarServiceWorker: vi.fn(),
}))

const { recargarAlCambiarServiceWorker, vigilarVersion } = await import('../lib/version.js')
const { default: AvisoVersion } = await import('./AvisoVersion.jsx')

beforeEach(() => {
  pwa.hayVersionNueva = false
  pwa.updateServiceWorker = vi.fn(async () => {})
  vi.clearAllMocks()
})

describe('AvisoVersion', () => {
  it('sin versión nueva no muestra nada', () => {
    render(<AvisoVersion />)
    expect(screen.queryByText('Hay una versión nueva')).not.toBeInTheDocument()
  })

  it('con versión nueva, "Actualizar" activa el service worker nuevo y recarga', () => {
    pwa.hayVersionNueva = true
    render(<AvisoVersion />)
    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true)
    // Y deja lista la recarga para cuando el service worker nuevo tome el control
    expect(recargarAlCambiarServiceWorker).toHaveBeenCalled()
  })

  it('"Ahora no" lo cierra sin recargar', () => {
    pwa.hayVersionNueva = true
    render(<AvisoVersion />)
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }))
    expect(screen.queryByText('Hay una versión nueva')).not.toBeInTheDocument()
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('al registrarse el service worker empieza a revisar si hay versión nueva', () => {
    render(<AvisoVersion />)
    const registro = { update: vi.fn() }
    pwa.opciones.onRegisteredSW('/sw.js', registro)
    expect(vigilarVersion).toHaveBeenCalledWith(registro, '/sw.js')
  })
})
