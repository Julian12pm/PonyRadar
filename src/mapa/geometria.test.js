import { describe, it, expect } from 'vitest'
import {
  aPuntosSvg,
  aRuta,
  area,
  caja,
  dentro,
  muros,
  puntoEtiqueta,
  rectanguloOrientado,
} from './geometria.js'

const cuadro = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]
// Forma de U abierta hacia arriba: el centro de su caja queda fuera del edificio
const formaU = [
  [0, 0],
  [4, 0],
  [4, 8],
  [8, 8],
  [8, 0],
  [12, 0],
  [12, 12],
  [0, 12],
]

describe('formatos SVG', () => {
  it('convierte puntos al formato de points, con desplazamiento', () => {
    expect(
      aPuntosSvg(
        [
          [1, 2],
          [3.14159, 4],
        ],
        1,
        0,
      ),
    ).toBe('2,2 4.1,4')
  })

  it('arma una ruta abierta o cerrada', () => {
    expect(
      aRuta([
        [0, 0],
        [5, 5],
      ]),
    ).toBe('M0 0L5 5')
    expect(
      aRuta(
        [
          [0, 0],
          [5, 5],
        ],
        true,
      ),
    ).toBe('M0 0L5 5Z')
  })
})

describe('dentro', () => {
  it('detecta puntos dentro y fuera', () => {
    expect(dentro([5, 5], cuadro)).toBe(true)
    expect(dentro([15, 5], cuadro)).toBe(false)
  })

  it('respeta los huecos de formas cóncavas', () => {
    expect(dentro([6, 4], formaU)).toBe(false)
    expect(dentro([2, 4], formaU)).toBe(true)
  })
})

describe('medidas', () => {
  it('calcula caja y área', () => {
    expect(caja(cuadro)).toEqual({ x0: 0, y0: 0, x1: 10, y1: 10 })
    expect(area(cuadro)).toBe(100)
    expect(area(formaU)).toBe(12 * 12 - 4 * 8)
  })
})

describe('puntoEtiqueta', () => {
  it('pone la etiqueta del cuadro cerca del centro', () => {
    const [x, y] = puntoEtiqueta(cuadro)
    expect(x).toBeCloseTo(5, 0)
    expect(y).toBeCloseTo(5, 0)
  })

  it('en una U elige un punto dentro del edificio', () => {
    expect(dentro(puntoEtiqueta(formaU), formaU)).toBe(true)
  })
})

describe('rectanguloOrientado', () => {
  it('mide un rectángulo girado 45°', () => {
    // Rectángulo de 20 × 10 girado 45° alrededor de (0, 0)
    const c = Math.SQRT1_2
    const giro = ([x, y]) => [x * c - y * c, x * c + y * c]
    const r = rectanguloOrientado(
      [
        [-10, -5],
        [10, -5],
        [10, 5],
        [-10, 5],
      ].map(giro),
    )
    expect(r.largo).toBeCloseTo(20)
    expect(r.ancho).toBeCloseTo(10)
    expect(Math.abs(r.cx)).toBeLessThan(1e-9)
    expect(((r.angulo % 180) + 180) % 180).toBeCloseTo(45)
  })
})

describe('muros', () => {
  it('crea un muro por lado, subido a la altura del techo', () => {
    const m = muros(cuadro, 3)
    expect(m).toHaveLength(4)
    expect(m[0].puntos).toEqual([
      [0, 0],
      [10, 0],
      [10, -3],
      [0, -3],
    ])
    // El primer lado es horizontal (mira al norte/sur) y el segundo vertical (mira a los lados)
    expect(m[0].luz).toBe(1)
    expect(m[1].luz).toBe(0)
  })
})
