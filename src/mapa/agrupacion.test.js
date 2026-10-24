import { describe, it, expect } from 'vitest'
import { agrupar, escalaParaSeparar } from './agrupacion.js'

const pines = [
  { id: 'a', punto: [0, 0] },
  { id: 'b', punto: [10, 0] },
  { id: 'c', punto: [100, 0] },
]

describe('agrupar', () => {
  it('junta los pines cercanos en pantalla al alejar', () => {
    // A 1 px/m, a y b están a 10 px (se juntan) y c a 100 px (queda solo)
    const grupos = agrupar(pines, 1)
    expect(grupos).toHaveLength(2)
    expect(grupos[0].pines.map((p) => p.id)).toEqual(['a', 'b'])
    expect(grupos[0].punto).toEqual([5, 0])
    expect(grupos[1].pines.map((p) => p.id)).toEqual(['c'])
  })

  it('los separa al acercar', () => {
    // A 5 px/m, a y b quedan a 50 px
    expect(agrupar(pines, 5)).toHaveLength(3)
  })

  it('al alejar mucho todos quedan en un solo grupo', () => {
    expect(agrupar(pines, 0.2)).toHaveLength(1)
  })

  it('da el mismo resultado sin importar el orden de entrada', () => {
    const alReves = agrupar([...pines].reverse(), 1)
    expect(alReves).toEqual(agrupar(pines, 1))
  })

  it('sin pines no hay grupos', () => {
    expect(agrupar([], 1)).toEqual([])
  })
})

describe('escalaParaSeparar', () => {
  it('calcula el zoom con el que el grupo se separa', () => {
    // a y b están a 10 m: hace falta más de 3 px/m para que estén a más de 30 px
    const k = escalaParaSeparar(pines.slice(0, 2))
    expect(k).toBeGreaterThan(3)
    expect(agrupar(pines.slice(0, 2), k)).toHaveLength(2)
  })

  it('pines en el mismo punto nunca se separan', () => {
    const iguales = [
      { id: 'x', punto: [1, 1] },
      { id: 'y', punto: [1, 1] },
    ]
    expect(escalaParaSeparar(iguales)).toBe(Infinity)
  })
})
