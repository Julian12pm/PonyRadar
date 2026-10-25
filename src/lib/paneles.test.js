import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase.js', () => ({ supabase: {}, configurado: true }))
const { esAdmin, finDeSemestre, horasDesde, puedeMarcarNoReclamado, veaPanelPunto } =
  await import('./paneles.js')

const semestres = [
  { nombre: 'Enero–Junio 2026', fecha_inicio: '2026-01-15', fecha_fin: '2026-06-30' },
  { nombre: 'Agosto–Diciembre 2026', fecha_inicio: '2026-08-01', fecha_fin: '2026-12-31' },
]

describe('acceso a los paneles', () => {
  it('el panel de punto seguro lo ven el personal y el admin; el de admin, solo el admin', () => {
    expect(veaPanelPunto({ rol: 'comunidad' })).toBe(false)
    expect(veaPanelPunto({ rol: 'punto_seguro' })).toBe(true)
    expect(veaPanelPunto({ rol: 'admin' })).toBe(true)
    expect(veaPanelPunto(null)).toBe(false)
    expect(esAdmin({ rol: 'punto_seguro' })).toBe(false)
    expect(esAdmin({ rol: 'admin' })).toBe(true)
  })
})

describe('"no reclamado" al terminar el semestre en que se recibió', () => {
  it('encuentra el fin del semestre de la fecha de recepción', () => {
    expect(finDeSemestre('2026-10-20T15:00:00Z', semestres)).toBe('2026-12-31')
    expect(finDeSemestre('2026-07-10T15:00:00Z', semestres)).toBeNull() // entre semestres
    expect(finDeSemestre(null, semestres)).toBeNull()
  })

  it('solo se puede marcar después del último día', () => {
    const recibido = '2026-10-20T15:00:00Z'
    expect(puedeMarcarNoReclamado(recibido, semestres, new Date('2026-12-31T20:00:00Z'))).toBe(
      false,
    )
    expect(puedeMarcarNoReclamado(recibido, semestres, new Date('2027-01-01T12:00:00Z'))).toBe(true)
    // Recibido fuera de cualquier semestre: se puede marcar ya
    expect(puedeMarcarNoReclamado('2026-07-10T15:00:00Z', semestres, new Date('2026-07-11'))).toBe(
      true,
    )
  })
})

describe('horasDesde', () => {
  it('cuenta horas completas', () => {
    const ahora = new Date('2026-10-25T12:00:00Z')
    expect(horasDesde('2026-10-24T10:30:00Z', ahora)).toBe(25)
  })
})
