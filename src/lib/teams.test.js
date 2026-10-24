import { describe, it, expect } from 'vitest'
import { enlaceTeams, mensajeInicial } from './teams.js'

describe('enlaceTeams', () => {
  it('arma el enlace de chat con el correo y el mensaje codificados', () => {
    const enlace = enlaceTeams('Ana.P@morelia.tecnm.mx', 'Hola, ¿nos vemos en la "K"?')
    expect(enlace).toBe(
      'https://teams.microsoft.com/l/chat/0/0?users=ana.p%40morelia.tecnm.mx&message=Hola%2C%20%C2%BFnos%20vemos%20en%20la%20%22K%22%3F',
    )
  })

  it('sin mensaje solo lleva el correo', () => {
    expect(enlaceTeams('a@morelia.tecnm.mx')).toBe(
      'https://teams.microsoft.com/l/chat/0/0?users=a%40morelia.tecnm.mx',
    )
  })

  it('el mensaje no puede romper el enlace con & o #', () => {
    const url = new URL(enlaceTeams('a@morelia.tecnm.mx', 'uno & dos #tres'))
    expect(url.searchParams.get('message')).toBe('uno & dos #tres')
    expect(url.searchParams.get('users')).toBe('a@morelia.tecnm.mx')
  })
})

describe('mensajeInicial', () => {
  it('cambia según a quién se le escribe', () => {
    expect(mensajeInicial('encontro', 'Termo azul')).toMatch(/reclamó "Termo azul"/)
    expect(mensajeInicial('dueno', 'Termo azul')).toMatch(/tengo "Termo azul"/)
  })
})
