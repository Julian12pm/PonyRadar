import { describe, it, expect } from 'vitest'
import { esCorreoInstitucional } from './correo.js'

describe('esCorreoInstitucional', () => {
  it('acepta un correo del dominio del ITM', () => {
    expect(esCorreoInstitucional('l21120001@morelia.tecnm.mx')).toBe(true)
  })

  it('ignora mayúsculas y espacios alrededor', () => {
    expect(esCorreoInstitucional('  Juan.Perez@MORELIA.TECNM.MX ')).toBe(true)
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
