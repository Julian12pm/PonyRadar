import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from './App.jsx'

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

const pinesEnMapa = (tipo) =>
  screen.queryAllByRole('button', { name: new RegExp(`^${tipo}:`) }).length

describe('App', () => {
  it('muestra el nombre de la app', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /ponyradar/i })).toBeInTheDocument()
  })

  it('"Perdí algo" activa el modo para colocar un pin y se puede cancelar', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Perdí algo' }))
    expect(screen.getByRole('status')).toHaveTextContent('Toca el mapa donde lo perdiste')
    // Mientras se coloca el pin, los botones de salto se cambian por el aviso
    expect(screen.queryByRole('navigation', { name: 'Ir a una unidad' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Ir a una unidad' })).toBeInTheDocument()
  })

  it('el filtro "Perdidos" quita los pines verdes del mapa', () => {
    render(<App />)
    expect(pinesEnMapa('Encontrado')).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Perdidos' }))
    expect(pinesEnMapa('Encontrado')).toBe(0)
    expect(pinesEnMapa('Perdido')).toBeGreaterThan(0)
  })

  it('al tocar un pin se abre su tarjeta', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Calculadora Casio/ }))
    expect(screen.getByRole('dialog', { name: 'Calculadora Casio gris' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
