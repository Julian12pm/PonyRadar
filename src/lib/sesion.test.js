import { describe, it, expect, vi } from 'vitest'
import { CATEGORIAS } from './categorias.js'
import { GUIAS_FOTO, medidasReducidas } from './fotos.js'

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(async () => ({ error: null })),
  verifyOtp: vi.fn(async () => ({ error: null })),
}))
vi.mock('./supabase.js', () => ({ supabase: { auth }, configurado: true }))

const { enviarCodigo, puedePublicar, traducirErrorAuth, verificarCodigo } =
  await import('./sesion.js')

describe('enviarCodigo', () => {
  it('no manda nada si el correo no es institucional', async () => {
    await expect(enviarCodigo('alguien@gmail.com')).rejects.toThrow('@morelia.tecnm.mx')
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('pide el código con el correo limpio y permite crear la cuenta', async () => {
    await enviarCodigo('  L21120001@Morelia.TecNM.mx ')
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'l21120001@morelia.tecnm.mx',
      options: { shouldCreateUser: true },
    })
  })
})

describe('verificarCodigo', () => {
  it('verifica el código de tipo email', async () => {
    await verificarCodigo('A@morelia.tecnm.mx', ' 123456 ')
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'a@morelia.tecnm.mx',
      token: '123456',
      type: 'email',
    })
  })

  it('traduce el error de código vencido', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ error: { message: 'Token has expired or is invalid' } })
    await expect(verificarCodigo('a@morelia.tecnm.mx', '000000')).rejects.toThrow('ya expiró')
  })
})

describe('traducirErrorAuth', () => {
  it('explica los errores más comunes', () => {
    expect(traducirErrorAuth({ message: 'email rate limit exceeded' })).toMatch(/demasiados/)
    expect(traducirErrorAuth({ message: 'Failed to fetch' })).toMatch(/conexión/)
    expect(traducirErrorAuth({ message: 'Solo se aceptan correos @morelia.tecnm.mx' })).toMatch(
      /institucional/,
    )
    expect(traducirErrorAuth({})).toMatch(/salió mal/)
  })
})

describe('puedePublicar', () => {
  const ahora = new Date('2026-10-24T12:00:00Z')
  it('permite publicar si no hay suspensión ni bloqueo', () => {
    expect(puedePublicar({ bloqueado: false, suspendido_hasta: null }, ahora)).toBe(true)
    expect(
      puedePublicar({ bloqueado: false, suspendido_hasta: '2026-10-01T00:00:00Z' }, ahora),
    ).toBe(true)
  })

  it('bloquea mientras dure la suspensión o si está bloqueado', () => {
    expect(
      puedePublicar({ bloqueado: false, suspendido_hasta: '2026-10-30T00:00:00Z' }, ahora),
    ).toBe(false)
    expect(puedePublicar({ bloqueado: true, suspendido_hasta: null }, ahora)).toBe(false)
    expect(puedePublicar(null, ahora)).toBe(false)
  })
})

describe('fotos', () => {
  it('hay una guía de foto para cada categoría', () => {
    for (const c of CATEGORIAS) expect(GUIAS_FOTO[c.id], c.id).toBeTruthy()
    // La de mochilas sigue la especificación: cerrada y sin contenido
    expect(GUIAS_FOTO.mochilas).toMatch(/[Cc]errada/)
  })

  it('reduce la foto sin deformarla y sin agrandar las pequeñas', () => {
    expect(medidasReducidas(4000, 3000, 1280)).toEqual({ ancho: 1280, alto: 960 })
    expect(medidasReducidas(3000, 4000, 1280)).toEqual({ ancho: 960, alto: 1280 })
    expect(medidasReducidas(800, 600, 1280)).toEqual({ ancho: 800, alto: 600 })
  })
})
