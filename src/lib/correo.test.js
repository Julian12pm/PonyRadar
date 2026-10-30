import { describe, it, expect } from 'vitest'
import { buzonDe, esCorreoInstitucional, tieneAlias } from './correo.js'

describe('esCorreoInstitucional', () => {
  it('acepta un correo del dominio del ITM', () => {
    expect(esCorreoInstitucional('l21120001@morelia.tecnm.mx')).toBe(true)
  })

  it('ignora mayúsculas y espacios alrededor', () => {
    expect(esCorreoInstitucional('  Juan.Perez@MORELIA.TECNM.MX ')).toBe(true)
  })

  it('acepta alias con "+" antes de la @ (Microsoft 365 los entrega en la misma bandeja)', () => {
    expect(esCorreoInstitucional('l23121115+admin@morelia.tecnm.mx')).toBe(true)
    expect(esCorreoInstitucional('L23121115+Punto.Seguro@Morelia.TecNM.mx')).toBe(true)
  })

  it('con "+" sigue exigiendo @morelia.tecnm.mx al final', () => {
    expect(esCorreoInstitucional('l23121115+admin@gmail.com')).toBe(false)
    expect(esCorreoInstitucional('l23121115+admin@morelia.tecnm.mx.evil.com')).toBe(false)
    expect(esCorreoInstitucional('l23121115+@morelia.tecnm.mx@gmail.com')).toBe(false)
    expect(esCorreoInstitucional('+admin@gmail.com')).toBe(false)
  })

  it('rechaza otros dominios', () => {
    expect(esCorreoInstitucional('alguien@gmail.com')).toBe(false)
    expect(esCorreoInstitucional('alguien@tecnm.mx')).toBe(false)
  })

  it('rechaza dominios que solo se parecen', () => {
    expect(esCorreoInstitucional('alguien@morelia.tecnm.mx.com')).toBe(false)
    expect(esCorreoInstitucional('alguien@falso-morelia.tecnm.mx')).toBe(false)
    expect(esCorreoInstitucional('alguien@moreliaXtecnm.mx')).toBe(false)
  })

  it('rechaza correos mal formados o vacíos', () => {
    expect(esCorreoInstitucional('')).toBe(false)
    expect(esCorreoInstitucional('@morelia.tecnm.mx')).toBe(false)
    expect(esCorreoInstitucional('a@b@morelia.tecnm.mx')).toBe(false)
    expect(esCorreoInstitucional('con espacio@morelia.tecnm.mx')).toBe(false)
    expect(esCorreoInstitucional(null)).toBe(false)
  })
})

describe('buzonDe y tieneAlias (una cuenta por buzón)', () => {
  it('quita el "+alias" y deja el buzón real', () => {
    expect(buzonDe('l23121064+sec@morelia.tecnm.mx')).toBe('l23121064@morelia.tecnm.mx')
    expect(buzonDe(' L23121064+Otro.Mas@Morelia.TecNM.mx ')).toBe('l23121064@morelia.tecnm.mx')
    expect(buzonDe('l23121064@morelia.tecnm.mx')).toBe('l23121064@morelia.tecnm.mx')
  })

  it('distingue cuentas con alias', () => {
    expect(tieneAlias('l23121115+admin@morelia.tecnm.mx')).toBe(true)
    expect(tieneAlias('l23121115@morelia.tecnm.mx')).toBe(false)
    expect(tieneAlias(null)).toBe(false)
  })
})
