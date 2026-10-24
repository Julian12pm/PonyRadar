import { describe, it, expect } from 'vitest'
import { encuadrar, nivelDetalle } from './vista.js'

describe('encuadrar', () => {
  const pantalla = { ancho: 400, alto: 800 }
  const margenes = { arriba: 100, abajo: 100, lados: 0 }

  it('ajusta al ancho cuando el contenido es más ancho que alto', () => {
    const v = encuadrar({ x0: 0, y0: 0, x1: 200, y1: 100 }, pantalla, margenes)
    expect(v.escala).toBe(2)
    expect(v.x).toBe(0)
    // Centrado verticalmente en el espacio libre (600 px de alto, contenido de 200 px)
    expect(v.y).toBe(100 + 200)
  })

  it('compensa cuando la caja no empieza en el origen', () => {
    const v = encuadrar({ x0: 50, y0: 50, x1: 250, y1: 150 }, pantalla, margenes)
    expect(v.x).toBe(-100)
    expect(v.y).toBe(300 - 100)
  })

  it('ajusta al alto cuando el contenido es muy alto', () => {
    const v = encuadrar({ x0: 0, y0: 0, x1: 100, y1: 1200 }, pantalla, margenes)
    expect(v.escala).toBe(0.5)
    expect(v.x).toBe((400 - 50) / 2)
  })
})

describe('nivelDetalle', () => {
  it('sube el detalle al acercar', () => {
    expect(nivelDetalle(0.7)).toBe(1)
    expect(nivelDetalle(1.3)).toBe(2)
    expect(nivelDetalle(2)).toBe(2)
    expect(nivelDetalle(2.4)).toBe(3)
  })
})
