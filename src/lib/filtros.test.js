import { describe, it, expect } from 'vitest'
import { CATEGORIAS, nombreCategoria } from './categorias.js'
import { filtrarPines } from './filtros.js'
import { haceCuanto } from './tiempo.js'

const pines = [
  { id: '1', tipo: 'rojo', categoria: 'llaves' },
  { id: '2', tipo: 'verde', categoria: 'llaves' },
  { id: '3', tipo: 'verde', categoria: 'electronicos' },
]

describe('filtrarPines', () => {
  it('sin filtro deja todos', () => {
    expect(filtrarPines(pines)).toHaveLength(3)
    expect(filtrarPines(pines, { tipo: 'todos', categoria: null })).toHaveLength(3)
  })

  it('filtra por tipo', () => {
    expect(filtrarPines(pines, { tipo: 'rojo' }).map((p) => p.id)).toEqual(['1'])
    expect(filtrarPines(pines, { tipo: 'verde' }).map((p) => p.id)).toEqual(['2', '3'])
  })

  it('filtra por categoría y combina ambos filtros', () => {
    expect(filtrarPines(pines, { categoria: 'llaves' })).toHaveLength(2)
    expect(filtrarPines(pines, { tipo: 'verde', categoria: 'llaves' }).map((p) => p.id)).toEqual([
      '2',
    ])
  })
})

describe('categorías', () => {
  it('son las 8 de la especificación', () => {
    expect(CATEGORIAS).toHaveLength(8)
    expect(nombreCategoria('termos')).toBe('Termos y loncheras')
    expect(nombreCategoria('no-existe')).toBe('Otros')
  })
})

describe('haceCuanto', () => {
  const ahora = new Date('2026-10-24T12:00:00')
  it('describe minutos, horas y días', () => {
    expect(haceCuanto('2026-10-24T11:59:40', ahora)).toBe('hace un momento')
    expect(haceCuanto('2026-10-24T11:45:00', ahora)).toBe('hace 15 min')
    expect(haceCuanto('2026-10-24T09:00:00', ahora)).toBe('hace 3 h')
    expect(haceCuanto('2026-10-23T11:00:00', ahora)).toBe('hace 1 día')
    expect(haceCuanto('2026-10-21T12:00:00', ahora)).toBe('hace 3 días')
  })
})
