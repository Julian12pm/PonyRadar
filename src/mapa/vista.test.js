import { describe, it, expect } from 'vitest'
import { areaVisible, encuadrar, nivelDetalle, nivelLetras, rellenar } from './vista.js'

describe('rellenar', () => {
  const contenido = { ancho: 600, alto: 600 }
  const pantalla = { ancho: 400, alto: 800 }

  it('acerca lo suficiente para que el contenido cubra toda la pantalla', () => {
    // El foco cabe a escala 2, pero para cubrir 800 px de alto con 600 px hace falta 800/600
    const v = rellenar({ x0: 200, y0: 200, x1: 400, y1: 400 }, contenido, pantalla)
    expect(v.escala).toBe(2)
    const sinHuecos = rellenar({ x0: 0, y0: 0, x1: 600, y1: 300 }, contenido, pantalla)
    expect(sinHuecos.escala).toBeCloseTo(800 / 600)
  })

  it('centra el foco y nunca deja ver fuera del contenido', () => {
    const v = rellenar({ x0: 200, y0: 200, x1: 400, y1: 400 }, contenido, pantalla)
    // Centro del foco (300, 300) a escala 2 queda en el centro de la pantalla
    expect(v.x).toBe(200 - 600)
    expect(v.y).toBe(400 - 600)
    // Un foco en la esquina se corrige para no mostrar el vacío
    const esquina = rellenar({ x0: 0, y0: 0, x1: 100, y1: 100 }, contenido, pantalla)
    expect(esquina.x).toBe(0)
    expect(esquina.y).toBe(0)
  })
})

describe('areaVisible', () => {
  it('calcula qué parte del contenido se ve', () => {
    expect(areaVisible({ escala: 2, x: -100, y: -50 }, { ancho: 400, alto: 300 })).toEqual({
      x0: 50,
      y0: 25,
      x1: 250,
      y1: 175,
    })
  })
})

describe('nivelLetras', () => {
  it('muestra más letras al acercar', () => {
    expect(nivelLetras(0.7)).toBe(1)
    expect(nivelLetras(1)).toBe(2)
    // Escritorio con el campus completo (≈1.15 px/m): todas las letras
    expect(nivelLetras(1.15)).toBe(3)
  })
})

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
