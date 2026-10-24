import { describe, it, expect } from 'vitest'
import { esErrorDeRed, esperaReintento, guardarLocal, leerLocal, borrarLocal } from './conexion.js'

describe('esErrorDeRed', () => {
  it('reconoce fallas de red y del servidor', () => {
    expect(esErrorDeRed(new TypeError('Failed to fetch'))).toBe(true)
    expect(esErrorDeRed(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      true,
    )
    expect(esErrorDeRed({ message: 'fetch failed' })).toBe(true)
    expect(esErrorDeRed({ status: 503, message: 'Service Unavailable' })).toBe(true)
    expect(esErrorDeRed({ status: 0 })).toBe(true)
    expect(esErrorDeRed({ name: 'AbortError', message: 'The operation was aborted' })).toBe(true)
  })

  it('no confunde errores de la base de datos con fallas de red', () => {
    expect(esErrorDeRed({ message: 'Tu cuenta está suspendida' })).toBe(false)
    expect(esErrorDeRed({ status: 400, message: 'violates check constraint' })).toBe(false)
    expect(esErrorDeRed({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(esErrorDeRed(null)).toBe(false)
  })
})

describe('esperaReintento', () => {
  it('crece al doble en cada intento', () => {
    expect([0, 1, 2, 3].map((i) => esperaReintento(i))).toEqual([1000, 2000, 4000, 8000])
  })

  it('no pasa del tope', () => {
    expect(esperaReintento(10)).toBe(30000)
    expect(esperaReintento(50, { maximo: 5000 })).toBe(5000)
  })

  it('agrega como máximo 20 % de variación', () => {
    expect(esperaReintento(1, { azar: 1 })).toBe(2400)
  })
})

describe('copia local', () => {
  const almacen = () => {
    const datos = new Map()
    return {
      getItem: (k) => datos.get(k) ?? null,
      setItem: (k, v) => datos.set(k, v),
      removeItem: (k) => datos.delete(k),
    }
  }

  it('guarda, lee y borra con la fecha de guardado', () => {
    const a = almacen()
    guardarLocal('x', [1, 2], a)
    const leido = leerLocal('x', a)
    expect(leido.valor).toEqual([1, 2])
    expect(new Date(leido.guardado).getTime()).not.toBeNaN()
    borrarLocal('x', a)
    expect(leerLocal('x', a)).toBeNull()
  })

  it('si el almacenamiento falla, no rompe la app', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('lleno')
      },
    }
    expect(() => guardarLocal('x', 1, roto)).not.toThrow()
    expect(leerLocal('x', roto)).toBeNull()
    expect(leerLocal('x', { getItem: () => '{no es json' })).toBeNull()
  })
})
