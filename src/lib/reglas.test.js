import { describe, it, expect } from 'vitest'
import {
  castigoPorStrikes,
  debeLlevarseAPuntoSeguro,
  diasEnSeBusca,
  enSeBusca,
  mensajeStrikes,
  motivoSuspension,
  puedeRenovar,
} from './reglas.js'

const ahora = new Date('2026-10-24T12:00:00Z')
const haceDias = (d) => new Date(ahora.getTime() - d * 86400000).toISOString()
const enDias = (d) => haceDias(-d)

describe('castigoPorStrikes (tabla de la sección 6)', () => {
  it.each([
    [0, { tipo: 'ninguno' }],
    [1, { tipo: 'aviso' }],
    [2, { tipo: 'aviso' }],
    [3, { tipo: 'suspension', dias: 7 }],
    [4, { tipo: 'suspension', dias: 30 }],
    [5, { tipo: 'bloqueo' }],
    [9, { tipo: 'bloqueo' }],
  ])('%i strikes → %o', (n, esperado) => {
    expect(castigoPorStrikes(n)).toEqual(esperado)
  })
})

describe('mensajeStrikes', () => {
  it('sin strikes no hay mensaje', () => {
    expect(mensajeStrikes(0, {}, ahora)).toBeNull()
  })

  it('avisa lo que pasa con el siguiente', () => {
    expect(mensajeStrikes(1, {}, ahora)).toMatch(/1 strike este semestre/)
    expect(mensajeStrikes(2, {}, ahora)).toMatch(/Con uno más se suspende tu cuenta 7 días/)
    expect(mensajeStrikes(4, {}, ahora)).toMatch(/Con uno más tu cuenta se bloquea/)
  })

  it('suspendida: dice hasta cuándo; bloqueada: lo dice', () => {
    expect(mensajeStrikes(3, { suspendido_hasta: enDias(7) }, ahora)).toMatch(
      /suspendida hasta el 31 oct/,
    )
    expect(mensajeStrikes(5, { bloqueado: true }, ahora)).toMatch(/bloqueada/)
  })
})

describe('motivoSuspension', () => {
  it('solo cuando aplica', () => {
    expect(motivoSuspension({ suspendido_hasta: haceDias(1) }, ahora)).toBeNull()
    expect(motivoSuspension({ suspendido_hasta: enDias(7) }, ahora)).toMatch(
      /suspendida hasta el 31 oct/,
    )
    expect(motivoSuspension({ bloqueado: true }, ahora)).toMatch(/bloqueada/)
    expect(motivoSuspension(null, ahora)).toBeNull()
  })
})

describe('"Se busca" y renovación', () => {
  const rojo = (cambios) => ({ tipo: 'rojo', estado: 'caducado', renovado: false, ...cambios })

  it('un rojo caducado está 30 días en "Se busca"', () => {
    expect(enSeBusca(rojo({ expira: haceDias(1) }), ahora)).toBe(true)
    expect(enSeBusca(rojo({ expira: haceDias(31) }), ahora)).toBe(false)
    expect(enSeBusca(rojo({ estado: 'activo', expira: enDias(1) }), ahora)).toBe(false)
    expect(enSeBusca(rojo({ tipo: 'verde', expira: haceDias(1) }), ahora)).toBe(false)
    expect(enSeBusca(rojo({ estado: 'entregado', expira: haceDias(1) }), ahora)).toBe(false)
    expect(diasEnSeBusca(rojo({ expira: haceDias(1) }), ahora)).toBe(29)
  })

  it('se renueva una sola vez', () => {
    expect(puedeRenovar(rojo({ expira: haceDias(2) }), ahora)).toBe(true)
    expect(puedeRenovar(rojo({ expira: haceDias(2), renovado: true }), ahora)).toBe(false)
    expect(puedeRenovar(rojo({ expira: haceDias(40) }), ahora)).toBe(false)
  })
})

describe('debeLlevarseAPuntoSeguro', () => {
  it('verde vencido sin entregar', () => {
    expect(debeLlevarseAPuntoSeguro({ tipo: 'verde', estado: 'caducado' }, ahora)).toBe(true)
    expect(
      debeLlevarseAPuntoSeguro({ tipo: 'verde', estado: 'activo', expira: haceDias(1) }, ahora),
    ).toBe(true)
    expect(
      debeLlevarseAPuntoSeguro({ tipo: 'verde', estado: 'activo', expira: enDias(1) }, ahora),
    ).toBe(false)
    expect(debeLlevarseAPuntoSeguro({ tipo: 'rojo', estado: 'caducado' }, ahora)).toBe(false)
  })
})
