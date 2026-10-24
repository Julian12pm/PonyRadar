import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase.js', () => ({ configurado: true, supabase: {} }))
vi.mock('../lib/pines.js', async (original) => ({
  ...(await original()),
  leerDatoCiego: vi.fn(async () => 'Calcomanía de Pumas'),
  enlaceFoto: vi.fn(async () => 'https://foto/nitida.webp'),
}))
vi.mock('../lib/casos.js', async (original) => ({
  ...(await original()),
  responderSolicitud: vi.fn(async () => null),
  generarClave: vi.fn(async () => '0427'),
  verificarClave: vi.fn(async () => ({ ok: false, intentosRestantes: 4 })),
  contactoDelCaso: vi.fn(async () => ({
    nombre: 'Ana López',
    correo: 'ana@morelia.tecnm.mx',
    papel: 'encontro',
  })),
}))

const casos = await import('../lib/casos.js')
const { default: TarjetaCaso } = await import('./TarjetaCaso.jsx')

const pin = {
  id: 'v1',
  tipo: 'verde',
  categoria: 'termos',
  titulo: 'Termo azul',
  estado: 'con_solicitud',
  creado: new Date().toISOString(),
  tieneFotoNitida: true,
}
const solicitud = (cambios = {}) => ({
  id: 's1',
  pinId: 'v1',
  solicitanteId: 'otro',
  respuesta: 'Tiene una calcomanía de Pumas',
  estado: 'pendiente',
  creada: new Date().toISOString(),
  intentos: 0,
  entregada: null,
  claveGenerada: null,
  ...cambios,
})

beforeEach(() => vi.clearAllMocks())

describe('TarjetaCaso: quien encontró', () => {
  it('compara la respuesta con su dato ciego y acepta', async () => {
    const onCambio = vi.fn()
    render(
      <TarjetaCaso
        caso={{ papel: 'encontre', pin, solicitudes: [solicitud()] }}
        onCambio={onCambio}
      />,
    )
    expect(screen.getByText('“Tiene una calcomanía de Pumas”')).toBeInTheDocument()
    expect(await screen.findByText('Calcomanía de Pumas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(onCambio).toHaveBeenCalled())
    expect(casos.responderSolicitud).toHaveBeenCalledWith('s1', 'aceptar')
  })

  it('"Impostor" pide confirmar antes de dar el strike', async () => {
    render(<TarjetaCaso caso={{ papel: 'encontre', pin, solicitudes: [solicitud()] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Impostor' }))
    expect(screen.getByText(/le suma un strike/)).toBeInTheDocument()
    expect(casos.responderSolicitud).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, es impostor' }))
    await waitFor(() => expect(casos.responderSolicitud).toHaveBeenCalledWith('s1', 'impostor'))
  })

  it('tras aceptar ve el contacto con Teams y escribe la clave; avisa los intentos que quedan', async () => {
    const aceptada = solicitud({ estado: 'aceptada', intentos: 0 })
    render(
      <TarjetaCaso
        caso={{ papel: 'encontre', pin: { ...pin, estado: 'aceptado' }, solicitudes: [aceptada] }}
      />,
    )
    const teams = await screen.findByRole('link', { name: 'Escribir en Teams' })
    expect(teams.getAttribute('href')).toMatch(
      /^https:\/\/teams\.microsoft\.com\/l\/chat\/0\/0\?users=ana%40morelia\.tecnm\.mx&message=/,
    )
    const entrada = screen.getByLabelText('Clave que te dicta el dueño')
    const confirmar = screen.getByRole('button', { name: 'Confirmar entrega' })
    fireEvent.change(entrada, { target: { value: '12a' } })
    expect(entrada).toHaveValue('12') // solo dígitos
    expect(confirmar).toBeDisabled()
    fireEvent.change(entrada, { target: { value: '1234' } })
    fireEvent.click(confirmar)
    expect(await screen.findByText('Clave incorrecta. Te quedan 4 intentos.')).toBeInTheDocument()
    expect(casos.verificarClave).toHaveBeenCalledWith('s1', '1234')
  })
})

describe('TarjetaCaso: el dueño aceptado', () => {
  it('ve la foto nítida, el contacto y su clave de 4 dígitos', async () => {
    render(
      <TarjetaCaso
        caso={{
          papel: 'reclame',
          pin,
          solicitud: solicitud({ estado: 'aceptada', solicitanteId: 'yo' }),
        }}
      />,
    )
    expect(await screen.findByAltText('Foto nítida del objeto')).toBeInTheDocument()
    expect(await screen.findByText('Ana López')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver mi clave de entrega' }))
    expect(await screen.findByLabelText('Clave 0 4 2 7')).toBeInTheDocument()
    expect(casos.generarClave).toHaveBeenCalledWith('s1')
  })
})
