import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../lib/supabase.js', () => ({ configurado: true, supabase: {} }))
vi.mock('../lib/casos.js', async (original) => ({
  ...(await original()),
  miSolicitudAlPin: vi.fn(async () => null),
  soyAutorDelPin: vi.fn(async () => false),
  loEncontre: vi.fn(async () => 'verde-1'),
}))

const casos = await import('../lib/casos.js')
const { default: AccionesPin } = await import('./AccionesPin.jsx')

const pin = (cambios) => ({
  id: 'p1',
  autorId: 'otro',
  tipo: 'verde',
  titulo: 'Audífonos',
  estado: 'activo',
  expira: new Date(Date.now() + 86400000).toISOString(),
  pinVinculadoId: null,
  encontrado: false,
  ...cambios,
})
const abrir = (p) => render(<AccionesPin pin={p} yo="yo" habilitado onVerCasos={() => {}} />)

beforeEach(() => vi.clearAllMocks())

describe('"Lo encontré" una sola vez', () => {
  it('en un rojo que ya encontraron no aparece el botón', () => {
    abrir(pin({ tipo: 'rojo', encontrado: true }))
    expect(screen.getByText(/Alguien ya dijo que lo encontró/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lo encontré' })).not.toBeInTheDocument()
  })

  it('si su verde caducó, el rojo vuelve a verse con la nota y sigue sin "Lo encontré"', () => {
    abrir(pin({ tipo: 'rojo', estado: 'caducado', encontrado: false, verdeEnCursoId: 'v1' }))
    expect(screen.getByText(/Alguien dijo que lo encontró/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lo encontré' })).not.toBeInTheDocument()
  })

  it('si dos personas lo intentan a la vez, la segunda ve el aviso del servidor', async () => {
    casos.loEncontre.mockRejectedValueOnce(new Error('Alguien ya dijo que lo encontró'))
    abrir(pin({ tipo: 'rojo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lo encontré' }))
    fireEvent.change(screen.getByLabelText(/Dato ciego/), { target: { value: 'Estuche rayado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Avisar al dueño' }))
    expect(await screen.findByText('Alguien ya dijo que lo encontró')).toBeInTheDocument()
  })
})

describe('"Es mío" en un verde vinculado', () => {
  it('otra persona no ve el botón', async () => {
    abrir(pin({ pinVinculadoId: 'rojo-1' }))
    expect(await screen.findByText(/solo esa persona puede reclamarlo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Es mío' })).not.toBeInTheDocument()
    expect(casos.soyAutorDelPin).toHaveBeenCalledWith('rojo-1', 'yo')
  })

  it('el dueño del pin rojo sí lo puede reclamar', async () => {
    casos.soyAutorDelPin.mockResolvedValueOnce(true)
    abrir(pin({ pinVinculadoId: 'rojo-1' }))
    expect(await screen.findByRole('button', { name: 'Es mío' })).toBeInTheDocument()
  })

  it('un verde vinculado caducado: el dueño del rojo lo reclama, nadie más', async () => {
    casos.soyAutorDelPin.mockResolvedValueOnce(true)
    const { unmount } = abrir(pin({ pinVinculadoId: 'rojo-1', estado: 'caducado' }))
    expect(await screen.findByRole('button', { name: 'Es mío' })).toBeInTheDocument()
    unmount()
    abrir(pin({ pinVinculadoId: 'rojo-1', estado: 'caducado' }))
    expect(await screen.findByText(/solo esa persona puede reclamarlo/)).toBeInTheDocument()
    // Un verde caducado sin vínculo no se reclama (debe ir a un punto seguro)
    abrir(pin({ id: 'p9', estado: 'caducado' }))
    expect(screen.queryAllByRole('button', { name: 'Es mío' })).toHaveLength(0)
  })

  it('un verde sin vínculo lo puede reclamar cualquiera (sin preguntar por el rojo)', async () => {
    abrir(pin())
    expect(await screen.findByRole('button', { name: 'Es mío' })).toBeInTheDocument()
    expect(casos.soyAutorDelPin).not.toHaveBeenCalled()
  })
})
