import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('../lib/supabase.js', () => ({ configurado: true, supabase: {} }))
vi.mock('../lib/casos.js', async (original) => ({
  ...(await original()),
  contactoDelCaso: vi.fn(async () => ({
    nombre: 'Beto',
    correo: 'beto@morelia.tecnm.mx',
    papel: 'dueno',
  })),
  responderSolicitud: vi.fn(async () => null),
}))
vi.mock('../lib/paneles.js', async (original) => ({
  ...(await original()),
  buscarPerfiles: vi.fn(async () => [
    { id: 'yo', correo: 'l23121115+admin@morelia.tecnm.mx', rol: 'admin', bloqueado: false },
    { id: 'c', correo: 'carla@morelia.tecnm.mx', rol: 'comunidad', bloqueado: true },
    { id: 's', correo: 'l23121064+sec@morelia.tecnm.mx', rol: 'comunidad', bloqueado: false },
  ]),
  cargarAliasPermitidos: vi.fn(async () => [
    { correo: 'l23121115+admin@morelia.tecnm.mx', nota: 'Cuenta admin', creado_en: '' },
  ]),
  autorizarAlias: vi.fn(async () => null),
  quitarAlias: vi.fn(async () => null),
  buscarPines: vi.fn(async () => [
    {
      id: 'r1',
      tipo: 'rojo',
      categoria: 'otros',
      titulo: 'asdf!!',
      estado: 'activo',
      creado: new Date().toISOString(),
      autorCorreo: 'l23121064@morelia.tecnm.mx',
    },
  ]),
  eliminarPin: vi.fn(async () => null),
  cargarModeracion: vi.fn(async () => []),
  cargarStrikes: vi.fn(async () => [
    {
      id: 'k1',
      creado: '2026-10-20T12:00:00Z',
      quitado: null,
      respuesta: 'Es rojo',
      objeto: 'Termo',
    },
  ]),
  strikesVigentes: vi.fn(async () => 1),
  cambiarRol: vi.fn(async () => null),
  quitarStrike: vi.fn(async () => null),
  desbloquear: vi.fn(async () => null),
  cargarPuntosAdmin: vi.fn(async () => [
    { id: 'p1', nombre: 'Biblioteca (AF)', zona_id: 'edificio-AF', activo: true, personal: [] },
  ]),
  asignarPersonal: vi.fn(async () => null),
  cargarPanelPunto: vi.fn(),
  confirmarRecepcion: vi.fn(async () => null),
}))

const paneles = await import('../lib/paneles.js')
const casos = await import('../lib/casos.js')
const { default: PanelAdmin } = await import('./PanelAdmin.jsx')
const { default: PanelPunto } = await import('./PanelPunto.jsx')

const admin = { id: 'yo', correo: 'l23121115+admin@morelia.tecnm.mx', rol: 'admin' }
const en = (ruta, elemento) =>
  render(<MemoryRouter initialEntries={[ruta]}>{elemento}</MemoryRouter>)

beforeEach(() => vi.clearAllMocks())

describe('Panel de admin', () => {
  it('solo lo abre un admin', () => {
    en('/admin', <PanelAdmin perfil={{ id: 'a', rol: 'punto_seguro' }} />)
    expect(screen.getByText('Esta pantalla es solo para el admin.')).toBeInTheDocument()
    expect(paneles.buscarPerfiles).not.toHaveBeenCalled()
  })

  it('el admin no puede quitarse su propio rol', async () => {
    en('/admin', <PanelAdmin perfil={admin} />)
    fireEvent.click(
      await screen.findByRole('button', { name: /l23121115\+admin@morelia\.tecnm\.mx/ }),
    )
    expect(screen.getByLabelText('Rol')).toBeDisabled()
    expect(screen.getByText('No puedes quitarte el rol de admin a ti mismo.')).toBeInTheDocument()
  })

  it('cambia el rol de otra persona, quita strikes y desbloquea', async () => {
    en('/admin', <PanelAdmin perfil={admin} />)
    fireEvent.click(await screen.findByRole('button', { name: /carla@morelia\.tecnm\.mx/ }))
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'punto_seguro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(paneles.cambiarRol).toHaveBeenCalledWith('c', 'punto_seguro'))

    expect(await screen.findByText(/Reclamó "Termo"/)).toBeInTheDocument()
    const strike = screen.getByText(/Reclamó "Termo"/).closest('li')
    fireEvent.click(within(strike).getByRole('button', { name: 'Quitar' }))
    await waitFor(() => expect(paneles.quitarStrike).toHaveBeenCalledWith('k1'))

    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear cuenta' }))
    await waitFor(() => expect(paneles.desbloquear).toHaveBeenCalledWith('c'))
  })

  it('el admin se asigna a sí mismo como personal de la Biblioteca', async () => {
    en('/admin?vista=puntos', <PanelAdmin perfil={admin} />)
    const punto = (await screen.findByRole('heading', { name: 'Biblioteca (AF)' })).closest('li')
    // Activo y sin personal: se avisa que no aparece como opción para dejar objetos
    expect(within(punto).getByText(/Nadie atiende este punto/)).toBeInTheDocument()
    fireEvent.click(within(punto).getByRole('button', { name: 'Asignarme a mí' }))
    await waitFor(() =>
      expect(paneles.asignarPersonal).toHaveBeenCalledWith(
        'p1',
        'l23121115+admin@morelia.tecnm.mx',
      ),
    )
  })
})

describe('Moderación', () => {
  it('marca las cuentas con alias: autorizado o sin autorizar (con su buzón real)', async () => {
    en('/admin', <PanelAdmin perfil={admin} />)
    const propia = (await screen.findByRole('button', { name: /l23121115\+admin/ })).closest('li')
    expect(within(propia).getByText('Alias autorizado')).toBeInTheDocument()
    const otra = screen.getByRole('button', { name: /l23121064\+sec/ }).closest('li')
    expect(
      within(otra).getByText('Alias sin autorizar, buzón l23121064@morelia.tecnm.mx'),
    ).toBeInTheDocument()
    // Filtro para ver solo cuentas con "+"
    fireEvent.click(screen.getByLabelText('Solo cuentas con "+" en el correo'))
    await waitFor(() => expect(paneles.buscarPerfiles).toHaveBeenLastCalledWith('', true))
  })

  it('autoriza un alias solo si es institucional y lleva "+"', async () => {
    en('/admin', <PanelAdmin perfil={admin} />)
    const correo = await screen.findByLabelText('Correo con alias')
    const autorizar = screen.getByRole('button', { name: 'Autorizar alias' })
    fireEvent.change(correo, { target: { value: 'l23121115@morelia.tecnm.mx' } })
    expect(autorizar).toBeDisabled()
    fireEvent.change(correo, { target: { value: 'l23121115+prueba@morelia.tecnm.mx' } })
    fireEvent.click(autorizar)
    await waitFor(() =>
      expect(paneles.autorizarAlias).toHaveBeenCalledWith('l23121115+prueba@morelia.tecnm.mx', ''),
    )
  })

  it('eliminar un pin pide confirmación y motivo', async () => {
    en('/admin?vista=pines', <PanelAdmin perfil={admin} />)
    const fila = (await screen.findByText('asdf!!')).closest('li')
    fireEvent.click(within(fila).getByRole('button', { name: 'Eliminar' }))
    const eliminar = within(fila).getByRole('button', { name: 'Eliminar pin' })
    expect(eliminar).toBeDisabled()
    fireEvent.change(within(fila).getByLabelText('Motivo (queda registrado)'), {
      target: { value: 'Título basura' },
    })
    fireEvent.click(eliminar)
    await waitFor(() => expect(paneles.eliminarPin).toHaveBeenCalledWith('r1', 'Título basura'))
  })
})

describe('Panel de punto seguro', () => {
  const objeto = (cambios) => ({
    id: 'v1',
    tipo: 'verde',
    categoria: 'termos',
    titulo: 'Termo azul',
    zonaId: 'edificio-K',
    creado: '2026-10-24T12:00:00Z',
    ...cambios,
  })

  it('sin asignación lo dice (y al admin le indica dónde asignarse)', async () => {
    paneles.cargarPanelPunto.mockResolvedValue({
      puntos: [],
      objetos: [],
      solicitudes: [],
      datos: {},
      semestres: [],
    })
    en('/punto', <PanelPunto perfil={admin} />)
    expect(await screen.findByText('No atiendes ningún punto seguro.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ir al panel de admin' })).toBeInTheDocument()
  })

  it('confirma la recepción y revisa un reclamo contra el dato ciego', async () => {
    paneles.cargarPanelPunto.mockResolvedValue({
      puntos: [{ id: 'p1', nombre: 'Biblioteca (AF)' }],
      objetos: [
        objeto({
          id: 'c1',
          titulo: 'Sudadera',
          estado: 'en_camino',
          enCaminoDesde: new Date().toISOString(),
        }),
        objeto({ estado: 'en_resguardo', enResguardoDesde: '2026-10-24T12:00:00Z' }),
      ],
      solicitudes: [
        {
          id: 's1',
          pinId: 'v1',
          estado: 'pendiente',
          respuesta: 'Tiene una calcomanía de Pumas',
          intentos: 0,
        },
      ],
      datos: { v1: 'Calcomanía de Pumas abajo' },
      semestres: [],
    })
    en('/punto', <PanelPunto perfil={{ id: 'pepe', rol: 'punto_seguro' }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ya lo recibí' }))
    await waitFor(() => expect(paneles.confirmarRecepcion).toHaveBeenCalledWith('c1'))

    expect(screen.getByText('“Tiene una calcomanía de Pumas”')).toBeInTheDocument()
    expect(screen.getByText('Calcomanía de Pumas abajo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(casos.responderSolicitud).toHaveBeenCalledWith('s1', 'aceptar'))
  })
})
