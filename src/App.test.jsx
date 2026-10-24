import { afterAll, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// ─── Simulaciones: Supabase configurado, una sesión y pines de ejemplo ───
const estado = vi.hoisted(() => ({ sesion: { cargando: false, sesion: null, perfil: null } }))

vi.mock('./lib/supabase.js', () => ({ configurado: true, supabase: {} }))
vi.mock('./lib/sesion.js', async (original) => ({
  ...(await original()),
  useSesion: () => estado.sesion,
  cerrarSesion: vi.fn(),
}))
vi.mock('./lib/pines.js', async (original) => {
  const { PINES_DEMO } = await import('./mapa/demo.js')
  return {
    ...(await original()),
    cargarPines: vi.fn(async () => PINES_DEMO),
    escucharPines: vi.fn(() => () => {}),
    cargarPuntosSeguros: vi.fn(async () => [
      { id: 's1', nombre: 'Biblioteca (AF)', zonaId: 'edificio-AF', cantidad: 3 },
    ]),
    crearPin: vi.fn(async () => 'nuevo'),
  }
})

const { default: App } = await import('./App.jsx')

// jsdom no mide elementos: se simula una pantalla de celular para que el mapa se monte
const original = {}
beforeAll(() => {
  for (const prop of ['clientWidth', 'clientHeight']) {
    original[prop] = Object.getOwnPropertyDescriptor(Element.prototype, prop)
    Object.defineProperty(Element.prototype, prop, {
      configurable: true,
      get: () => (prop === 'clientWidth' ? 390 : 600),
    })
  }
})
afterAll(() => {
  for (const [prop, desc] of Object.entries(original)) {
    Object.defineProperty(Element.prototype, prop, desc)
  }
})

const perfil = { id: 'yo', nombre: 'l21120001', rol: 'comunidad', bloqueado: false }
const conSesion = (cambios = {}) => {
  estado.sesion = {
    cargando: false,
    sesion: { user: { id: 'yo' } },
    perfil: { ...perfil, ...cambios },
  }
}

const pinesEnMapa = (tipo) =>
  screen.queryAllByRole('button', { name: new RegExp(`^${tipo}:`) }).length

describe('App', () => {
  beforeEach(() => conSesion())

  it('sin sesión muestra el inicio de sesión', () => {
    estado.sesion = { cargando: false, sesion: null, perfil: null }
    render(<App />)
    expect(screen.getByLabelText('Correo institucional')).toBeInTheDocument()
  })

  it('con sesión muestra el mapa con los pines y el punto seguro', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /ponyradar/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Calculadora Casio/ })).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /Punto seguro Biblioteca/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('l21120001')).toBeInTheDocument()
  })

  it('"Perdí algo" activa el modo para colocar un pin y se puede cancelar', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /Calculadora Casio/ })
    fireEvent.click(screen.getByRole('button', { name: 'Perdí algo' }))
    expect(screen.getByRole('status')).toHaveTextContent('Toca el mapa donde lo perdiste')
    // Mientras se coloca el pin, los botones de salto se cambian por el aviso
    expect(screen.queryByRole('navigation', { name: 'Ir a una unidad' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Ir a una unidad' })).toBeInTheDocument()
  })

  it('el filtro "Perdidos" quita los pines verdes del mapa', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /Calculadora Casio/ })
    expect(pinesEnMapa('Encontrado')).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Perdidos' }))
    expect(pinesEnMapa('Encontrado')).toBe(0)
    expect(pinesEnMapa('Perdido')).toBeGreaterThan(0)
  })

  it('al tocar un pin se abre su tarjeta', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Calculadora Casio/ }))
    expect(screen.getByRole('dialog', { name: 'Calculadora Casio gris' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('con la cuenta suspendida se puede ver el mapa pero no publicar', async () => {
    conSesion({ suspendido_hasta: new Date(Date.now() + 86400000).toISOString() })
    render(<App />)
    await screen.findByRole('button', { name: /Calculadora Casio/ })
    expect(screen.queryByRole('button', { name: 'Perdí algo' })).not.toBeInTheDocument()
    expect(screen.getByText(/cuenta está suspendida/)).toBeInTheDocument()
  })
})
