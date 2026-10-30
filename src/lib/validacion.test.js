import { describe, it, expect } from 'vitest'
import { tituloValido } from './validacion.js'

describe('tituloValido (misma regla que el servidor)', () => {
  it.each([
    ['Llaves', true],
    ['INE', true],
    ['Ñu', false], // 2 caracteres
    ['Termo 2', true],
    ['  Paraguas  ', true],
    ['!!!!', false],
    ['¿¿?? 123', false],
    ['   ab   ', false],
    ['', false],
    [null, false],
    ['a'.repeat(60), true],
    ['a'.repeat(61), false],
  ])('"%s" → %s', (titulo, esperado) => {
    expect(tituloValido(titulo)).toBe(esperado)
  })
})
