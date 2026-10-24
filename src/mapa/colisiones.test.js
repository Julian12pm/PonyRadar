import { describe, it, expect } from 'vitest'
import { letrasTapadas } from './colisiones.js'

const letra = { id: 'edificio-CH', punto: [100, 100], texto: 'CH' }

describe('letrasTapadas', () => {
  it('marca la letra cuando la cabeza de un alfiler le queda encima', () => {
    // A 1 px/m, la cabeza queda 29 px (29 m) arriba del punto del pin
    const pin = { punto: [100, 129], forma: 'alfiler' }
    expect(letrasTapadas([letra], [pin], 1).has('edificio-CH')).toBe(true)
  })

  it('no marca la letra si el pin está lejos', () => {
    const pin = { punto: [160, 129], forma: 'alfiler' }
    expect(letrasTapadas([letra], [pin], 1).size).toBe(0)
  })

  it('al acercar, el mismo pin deja de tapar la letra', () => {
    // El pin está 10 m al sur: a 1 px/m la cabeza (29 px arriba) cae sobre la letra,
    // a 6 px/m el punto queda 60 px abajo y la cabeza 31 px abajo de la letra
    const pin = { punto: [100, 110], forma: 'alfiler' }
    expect(letrasTapadas([letra], [pin], 1).size).toBe(1)
    expect(letrasTapadas([letra], [pin], 6).size).toBe(0)
  })

  it('considera las burbujas centradas en su punto', () => {
    const burbuja = { punto: [105, 100], forma: 'circulo', radio: 20 }
    expect(letrasTapadas([letra], [burbuja], 1).has('edificio-CH')).toBe(true)
  })
})
