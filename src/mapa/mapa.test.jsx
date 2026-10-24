import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import TarjetaPin from '../componentes/TarjetaPin.jsx'
import { CapaBase, CapaEtiquetas } from './CroquisCampus.jsx'
import MapaCampus from './MapaCampus.jsx'
import { PINES_DEMO, SEGUROS_DEMO } from './demo.js'

describe('croquis', () => {
  it('dibuja cada zona con su id para detectar toques', () => {
    const { container } = render(<CapaBase />)
    for (const id of ['edificio-K', 'edificio-2A', 'estacionamiento-5', 'alberca', 'campo-pista']) {
      expect(container.querySelector(`[data-zona="${id}"]`), id).not.toBeNull()
    }
  })

  it('pone fondo a las letras tapadas por un pin', () => {
    const { container } = render(<CapaEtiquetas tapadas={new Set(['edificio-K'])} />)
    const letras = [...container.querySelectorAll('.letra')]
    expect(letras.find((l) => l.textContent === 'K')).toHaveClass('tapada')
    expect(letras.find((l) => l.textContent === 'I')).not.toHaveClass('tapada')
    // Calles perimetrales con nombre
    expect(container.textContent).toContain('Av. Tecnológico')
  })
})

describe('TarjetaPin', () => {
  it('muestra título, categoría, tipo y lugar', () => {
    const pin = { ...PINES_DEMO[0], piso: '2.º piso' }
    render(<TarjetaPin pin={pin} onCerrar={vi.fn()} />)
    expect(screen.getByRole('heading', { name: pin.titulo })).toBeInTheDocument()
    expect(screen.getByText(/Electrónicos/)).toBeInTheDocument()
    expect(screen.getByText('Se perdió')).toBeInTheDocument()
    expect(screen.getByText(/2\.º piso/)).toBeInTheDocument()
  })
})

describe('MapaCampus', () => {
  let altoSimulado = 600
  // jsdom no mide elementos: se simula una pantalla de celular para que el mapa se monte
  const original = {}
  beforeAll(() => {
    for (const prop of ['clientWidth', 'clientHeight']) {
      original[prop] = Object.getOwnPropertyDescriptor(Element.prototype, prop)
      Object.defineProperty(Element.prototype, prop, {
        configurable: true,
        get: () => (prop === 'clientWidth' ? 390 : altoSimulado),
      })
    }
  })
  afterAll(() => {
    for (const [prop, desc] of Object.entries(original)) {
      Object.defineProperty(Element.prototype, prop, desc)
    }
  })

  it('dibuja pines, burbujas y puntos seguros, y avisa al tocar un pin', () => {
    const onTocarPin = vi.fn()
    const onTocarSeguro = vi.fn()
    render(
      <MapaCampus
        pines={PINES_DEMO}
        seguros={SEGUROS_DEMO}
        onTocarPin={onTocarPin}
        onTocarSeguro={onTocarSeguro}
      />,
    )

    // Los 3 pines frente al gimnasio quedan agrupados en la vista inicial
    expect(screen.getByRole('button', { name: /3 pines aquí/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Calculadora Casio/ }))
    expect(onTocarPin).toHaveBeenCalledWith(expect.objectContaining({ id: 'demo-01' }))

    fireEvent.click(screen.getByRole('button', { name: /Punto seguro/ }))
    expect(onTocarSeguro).toHaveBeenCalled()
  })

  it('expone saltar() para ir a una unidad sin fallar', () => {
    const ref = { current: null }
    render(<MapaCampus ref={ref} pines={[]} />)
    expect(() => ref.current.saltar('unidad-metal-mecanica')).not.toThrow()
  })

  it('tocar un pin no mueve el mapa, aunque cambie el alto de la pantalla', () => {
    // En el celular, al tocar puede ocultarse la barra de direcciones y cambiar el alto del mapa.
    // Se simula ResizeObserver para poder avisar ese cambio (la librería de zoom también lo usa,
    // así que se guardan todos los avisos).
    const avisos = []
    const avisarCambio = () => avisos.forEach((aviso) => aviso([]))
    const ResizeObserverOriginal = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor(callback) {
        avisos.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    try {
      const onTocarPin = vi.fn()
      render(<MapaCampus pines={PINES_DEMO} onTocarPin={onTocarPin} />)
      const croquis = document.querySelector('.croquis')
      const zoom = () => croquis.style.getPropertyValue('--k')
      const posicion = () => document.querySelector('.mapa-contenido').style.transform
      const zoomAntes = zoom()
      const posicionAntes = posicion()

      fireEvent.click(screen.getByRole('button', { name: /Calculadora Casio/ }))
      expect(onTocarPin).toHaveBeenCalled()
      expect(posicion()).toBe(posicionAntes)

      // Cambia el alto: el mapa no se vuelve a montar ni cambia el zoom
      altoSimulado = 660
      act(() => avisarCambio())
      expect(document.querySelector('.croquis')).toBe(croquis)
      expect(zoom()).toBe(zoomAntes)
      const escala = Number(posicion().match(/scale\(([\d.]+)\)/)[1])
      expect(escala).toBeCloseTo(Number(zoomAntes), 3)
    } finally {
      globalThis.ResizeObserver = ResizeObserverOriginal
      altoSimulado = 600
    }
  })
})
