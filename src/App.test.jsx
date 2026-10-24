import { afterAll, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

// ─── Simulaciones: Supabase configurado, una sesión y pines de ejemplo ───
const estado = vi.hoisted(() => ({ sesion: { cargando: false, sesion: null, perfil: null } }))

vi.mock('./lib/supabase.js', () => ({ configurado: true, supabase: {} }))
vi.mock('./lib/sesion.js', async (original) => ({
  ...(await original()),
  useSesion: () => estado.sesion,
  cerrarSesion: vi.fn(),
}))
vi.mock('./lib/pines.js', async (original) => {
  const { PINES_DEMO } = await import('./mapa/demo.js')
  return {
    ...(await original()),
    // Pines de otra persona, activos
    cargarPines: vi.fn(async () =>
      PINES_DEMO.map((p) => ({ ...p, estado: 'activo', autorId: 'otro' })),
    ),
    escucharPines: vi.fn(() => () => {}),
    cargarPuntosSeguros: vi.fn(async () => [
      { id: 's1', nombre: 'Biblioteca (AF)', zonaId: 'edificio-AF', cantidad: 3 },
    ]),
    crearPin: vi.fn(async () => 'nuevo'),
  }
})

vi.mock('./lib/casos.js', async (original) => ({
  ...(await original()),
  cargarAvisos: vi.fn(async () => [
    {
      id: 'a1',
      tipo: 'solicitud_aceptada',
      pinId: 'demo-03',
      leido: false,
      creado: new Date().toISOString(),
      titulo: 'Termo azul',
    },
  ]),
  escucharAvisos: vi.fn(() => () => {}),
  marcarAvisosLeidos: vi.fn(async () => {}),
  miSolicitudAlPin: vi.fn(async () => null),
  solicitarPin: vi.fn(async () => 'sol-1'),
  loEncontre: vi.fn(async () => 'verde-1'),
  cargarCasos: vi.fn(async () => []),
  cargarPuntosActivos: vi.fn(async () => [{ id: 'p1', nombre: 'Biblioteca (AF)' }]),
  misStrikes: vi.fn(async () => 0),
  cargarListas: vi.fn(async () => ({
    seBusca: [
      {
        id: 'r-viejo',
        autorId: 'otro',
        tipo: 'rojo',
        categoria: 'mochilas',
        titulo: 'Mochila negra Jansport',
        zonaId: 'edificio-K',
        estado: 'caducado',
        creado: new Date(Date.now() - 5 * 86400000).toISOString(),
        expira: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ],
    enResguardo: [
      {
        id: 'v-guardado',
        autorId: 'otro',
        tipo: 'verde',
        categoria: 'electronicos',
        titulo: 'Calculadora',
        zonaId: 'edificio-K',
        estado: 'en_resguardo',
        puntoSeguroId: 'p1',
        creado: new Date().toISOString(),
      },
    ],
    puntos: [{ id: 'p1', nombre: 'Biblioteca (AF)' }],
  })),
}))

const { default: App } = await import('./App.jsx')

// jsdom no mide elementos: se simula una pantalla de celular para que el mapa se monte
const original = {}
beforeAll(() => {
  for (const prop of ['clientWidth', 'clientHeight']) {
    original[prop] = Object.getOwnPropertyDescriptor(Element.prototype, prop)
    Object.defineProperty(Element.prototype, prop, {
      configurable: true,
      get: () => (prop === 'clientWidth' ? 390 : 600),
    })
  }
})
afterAll(() => {
  for (const [prop, desc] of Object.entries(original)) {
    Object.defineProperty(Element.prototype, prop, desc)
  }
})

const perfil = { id: 'yo', nombre: 'l21120001', rol: 'comunidad', bloqueado: false }
const conSesion = (cambios = {}) => {
  estado.sesion = {
    cargando: false,
    sesion: { user: { id: 'yo' } },
    perfil: { ...perfil, ...cambios },
  }
}

const pinesEnMapa = (tipo) =>
  screen.queryAllByRole('button', { name: new RegExp(`^${tipo}:`) }).length

describe('App', () => {
  beforeEach(() => {
    // Cada prueba empieza en el mapa (el router usa la URL real de jsdom)
    window.history.replaceState(null, '', '/')
    conSesion()
  })

  it('sin sesión muestra el inicio de sesión', () => {
    estado.sesion = { cargando: false, sesion: null, perfil: null }
    render(<App />)
    expect(screen.getByLabelText('Correo institucional')).toBeInTheDocument()
  })

  it('con sesión muestra el mapa con los pines y el punto seguro', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /ponyradar/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Calculadora Casio/ })).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /Punto seguro Biblioteca/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('l21120001')).toBeInTheDocument()
  })

  it('"Perdí algo" activa el modo para colocar un pin y se puede cancelar', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /Calculadora Casio/ })
    fireEvent.click(screen.getByRole('button', { name: 'Perdí algo' }))
    expect(screen.getByRole('status')).toHaveTextContent('Toca el mapa donde lo perdiste')
    // Mientras se coloca el pin, los botones de salto se cambian por el aviso
    expect(screen.queryByRole('navigation', { name: 'Ir a una unidad' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Ir a una unidad' })).toBeInTheDocument()
  })

  it('el filtro "Perdidos" quita los pines verdes del mapa', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /Calculadora Casio/ })
    expect(pinesEnMapa('Encontrado')).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Perdidos' }))
    expect(pinesEnMapa('Encontrado')).toBe(0)
    expect(pinesEnMapa('Perdido')).toBeGreaterThan(0)
  })

  it('al tocar un pin se abre su tarjeta', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Calculadora Casio/ }))
    expect(screen.getByRole('dialog', { name: 'Calculadora Casio gris' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Es mío" en un pin verde ajeno envía la solicitud', async () => {
    const { solicitarPin } = await import('./lib/casos.js')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Termo azul/ }))
    const hoja = screen.getByRole('dialog', { name: 'Termo azul' })
    fireEvent.click(await within(hoja).findByRole('button', { name: 'Es mío' }))
    fireEvent.change(within(hoja).getByLabelText(/solo el dueño sabría/), {
      target: { value: 'Tiene una calcomanía de Pumas' },
    })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Enviar solicitud' }))
    expect(await within(hoja).findByText(/Solicitud enviada/)).toBeInTheDocument()
    expect(solicitarPin).toHaveBeenCalledWith('demo-03', 'Tiene una calcomanía de Pumas')
  })

  it('"Lo encontré" en un pin rojo ajeno pide el dato ciego', async () => {
    const { loEncontre } = await import('./lib/casos.js')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Calculadora Casio/ }))
    const hoja = screen.getByRole('dialog', { name: 'Calculadora Casio gris' })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Lo encontré' }))
    const avisar = within(hoja).getByRole('button', { name: 'Avisar al dueño' })
    expect(avisar).toBeDisabled()
    fireEvent.change(within(hoja).getByLabelText(/Dato ciego/), {
      target: { value: 'Tiene un nombre grabado' },
    })
    fireEvent.click(avisar)
    expect(await within(hoja).findByText(/avisamos al dueño/)).toBeInTheDocument()
    expect(loEncontre).toHaveBeenCalledWith('demo-01', {
      descripcion: '',
      datoCiego: 'Tiene un nombre grabado',
    })
  })

  it('el botón "Mis casos" muestra los avisos nuevos y abre la pantalla de casos', async () => {
    render(<App />)
    expect(await screen.findByLabelText('1 avisos nuevos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mis casos/ }))
    expect(await screen.findByRole('heading', { name: 'Mis casos' })).toBeInTheDocument()
    expect(screen.getByText(/Aceptaron tu solicitud de "Termo azul"/)).toBeInTheDocument()
    expect(await screen.findByText('Todavía no tienes casos.')).toBeInTheDocument()
    // Al verlos, los avisos quedan como leídos y el contador se apaga
    const { marcarAvisosLeidos } = await import('./lib/casos.js')
    expect(marcarAvisosLeidos).toHaveBeenCalledWith(['a1'])
    // Regresa al mapa
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }))
    expect(await screen.findByRole('button', { name: /Calculadora Casio/ })).toBeInTheDocument()
  })

  it('"Listas" muestra "Se busca" y "En resguardo"; desde ahí se reclama', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /Calculadora Casio/ })
    fireEvent.click(screen.getByRole('button', { name: 'Listas' }))
    expect(await screen.findByRole('tab', { name: /Se busca/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.click(await screen.findByRole('button', { name: /Mochila negra Jansport/ }))
    const hojaRoja = screen.getByRole('dialog', { name: 'Mochila negra Jansport' })
    expect(within(hojaRoja).getByRole('button', { name: 'Lo encontré' })).toBeInTheDocument()
    fireEvent.click(within(hojaRoja).getByRole('button', { name: 'Cerrar' }))

    fireEvent.click(screen.getByRole('tab', { name: /En resguardo/ }))
    expect(screen.getByRole('heading', { name: /Biblioteca \(AF\)/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Calculadora/ }))
    const hoja = screen.getByRole('dialog', { name: 'Calculadora' })
    expect(await within(hoja).findByRole('button', { name: 'Es mío' })).toBeInTheDocument()
  })

  it('en Mis casos se avisa de los strikes y de lo que pasa con el siguiente', async () => {
    const { misStrikes } = await import('./lib/casos.js')
    misStrikes.mockResolvedValueOnce(2)
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /^Mis casos/ }))
    expect(await screen.findByText(/Tienes 2 strikes este semestre/)).toBeInTheDocument()
    expect(screen.getByText(/se suspende tu cuenta 7 días/)).toBeInTheDocument()
  })

  it('con la cuenta suspendida se puede ver el mapa pero no publicar', async () => {
    conSesion({ suspendido_hasta: new Date(Date.now() + 86400000).toISOString() })
    render(<App />)
    await screen.findByRole('button', { name: /Calculadora Casio/ })
    expect(screen.queryByRole('button', { name: 'Perdí algo' })).not.toBeInTheDocument()
    expect(screen.getByText(/cuenta está suspendida hasta el/)).toBeInTheDocument()
  })
})

describe('App sin conexión con el servidor', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    conSesion()
    localStorage.clear()
  })

  it('avisa, muestra los últimos pines guardados y no deja publicar', async () => {
    const { cargarPines } = await import('./lib/pines.js')
    const { PINES_DEMO } = await import('./mapa/demo.js')
    // Copia local de una visita anterior y servidor caído
    const vigentes = PINES_DEMO.map((p) => ({
      ...p,
      estado: 'activo',
      expira: new Date(Date.now() + 86400000).toISOString(),
    }))
    localStorage.setItem('ponyradar:pines', JSON.stringify({ guardado: '', valor: vigentes }))
    cargarPines.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    try {
      render(<App />)
      expect(
        await screen.findByText('No hay conexión con el servidor, reintentando…'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Calculadora Casio/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Perdí algo' })).not.toBeInTheDocument()
      expect(screen.getByText(/solo puedes ver el mapa/)).toBeInTheDocument()
      // No se confunde con una suspensión
      expect(screen.queryByText(/cuenta está suspendida/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reintentar ahora' })).toBeInTheDocument()
    } finally {
      cargarPines.mockImplementation(async () =>
        PINES_DEMO.map((p) => ({ ...p, estado: 'activo', autorId: 'otro' })),
      )
    }
  })
})
