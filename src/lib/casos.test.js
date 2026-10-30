import { beforeEach, describe, it, expect, vi } from 'vitest'

// Cliente de Supabase simulado: registra las llamadas RPC y devuelve lo que indique cada prueba
const simulado = vi.hoisted(() => ({
  llamadas: [],
  respuestas: {},
  cliente: {
    rpc: async (nombre, parametros) => {
      simulado.llamadas.push({ nombre, parametros })
      return simulado.respuestas[nombre] ?? { data: null, error: null }
    },
  },
}))
vi.mock('./supabase.js', () => ({ supabase: simulado.cliente, configurado: true }))

const {
  accionPendiente,
  armarCasos,
  casoCerrado,
  cargarPuntosDisponibles,
  contactoDelCaso,
  filaASolicitud,
  loEncontre,
  resumenCaso,
  solicitarPin,
  textoAviso,
  verificarClave,
} = await import('./casos.js')

beforeEach(() => {
  simulado.llamadas.length = 0
  simulado.respuestas = {}
})

const pin = (id, cambios = {}) => ({
  id,
  tipo: 'verde',
  titulo: `Objeto ${id}`,
  estado: 'activo',
  creado: '2026-10-24T10:00:00Z',
  ...cambios,
})
const solicitud = (id, cambios = {}) => ({
  id,
  pinId: 'v1',
  solicitanteId: 'otro',
  respuesta: 'calcomanía',
  estado: 'pendiente',
  creada: '2026-10-24T11:00:00Z',
  intentos: 0,
  entregada: null,
  ...cambios,
})

describe('acciones del servidor', () => {
  it('"Es mío" manda la respuesta sin espacios de más', async () => {
    simulado.respuestas.solicitar_pin = { data: 's1', error: null }
    expect(await solicitarPin('v1', '  tiene un gato  ')).toBe('s1')
    expect(simulado.llamadas[0]).toEqual({
      nombre: 'solicitar_pin',
      parametros: { p_pin: 'v1', p_respuesta: 'tiene un gato' },
    })
  })

  it('el error del servidor llega con su mensaje', async () => {
    simulado.respuestas.solicitar_pin = {
      data: null,
      error: { message: 'Ya enviaste una solicitud para este objeto', code: 'P0001' },
    }
    await expect(solicitarPin('v1', 'algo')).rejects.toThrow('Ya enviaste una solicitud')
  })

  it('verificarClave traduce la respuesta del servidor', async () => {
    simulado.respuestas.verificar_clave = {
      data: { ok: false, intentos_restantes: 3 },
      error: null,
    }
    expect(await verificarClave('s1', ' 1234 ')).toEqual({ ok: false, intentosRestantes: 3 })
    expect(simulado.llamadas[0].parametros).toEqual({ p_solicitud: 's1', p_clave: '1234' })
  })

  it('contactoDelCaso regresa la primera fila', async () => {
    simulado.respuestas.contacto_del_caso = {
      data: [{ nombre: 'Ana', correo: 'ana@morelia.tecnm.mx', papel: 'encontro' }],
      error: null,
    }
    expect(await contactoDelCaso('s1')).toMatchObject({ nombre: 'Ana' })
  })

  it('los puntos para dejar un objeto los decide el servidor (activos y con personal)', async () => {
    simulado.respuestas.puntos_disponibles = {
      data: [{ id: 'p1', nombre: 'Biblioteca (AF)', zona_id: 'edificio-AF' }],
      error: null,
    }
    expect(await cargarPuntosDisponibles()).toHaveLength(1)
    expect(simulado.llamadas[0].nombre).toBe('puntos_disponibles')
  })

  it('"Lo encontré" manda el dato ciego', async () => {
    await loEncontre('r1', { datoCiego: 'nombre grabado' })
    expect(simulado.llamadas[0]).toEqual({
      nombre: 'lo_encontre',
      parametros: {
        p_pin_rojo: 'r1',
        p_descripcion: '',
        p_piso: '',
        p_dato_ciego: 'nombre grabado',
      },
    })
  })
})

describe('filaASolicitud', () => {
  it('convierte la fila y su pin', () => {
    const s = filaASolicitud({
      id: 's1',
      pin_id: 'v1',
      solicitante_id: 'yo',
      respuesta: 'x',
      estado: 'aceptada',
      creado_en: 'a',
      intentos_clave: 2,
      aceptada_en: 'b',
      entregada_en: null,
      clave_generada_en: null,
      pin: { id: 'v1', tipo: 'verde', titulo: 'Termo', x: 1, y: 2 },
    })
    expect(s).toMatchObject({ id: 's1', pinId: 'v1', intentos: 2, aceptada: 'b' })
    expect(s.pin).toMatchObject({ id: 'v1', punto: [1, 2] })
  })
})

describe('armarCasos', () => {
  it('reúne mis pines y mis solicitudes, primero lo que me toca y al final lo cerrado', () => {
    const casos = armarCasos(
      {
        pines: [pin('v1'), pin('v2', { estado: 'entregado' }), pin('r1', { tipo: 'rojo' })],
        solicitudes: [
          solicitud('s1', { pinId: 'v1' }),
          solicitud('s2', { pinId: 'x9', solicitanteId: 'yo', pin: pin('x9') }),
        ],
      },
      'yo',
    )
    expect(casos.map((c) => [c.id, c.papel])).toEqual([
      ['pin-v1', 'encontre'], // tiene una solicitud por responder
      ['sol-s2', 'reclame'],
      ['pin-r1', 'perdi'],
      ['pin-v2', 'encontre'], // entregado
    ])
    expect(casos[0].solicitudes.map((s) => s.id)).toEqual(['s1'])
  })

  it('liga los "Lo encontré" a mi pin rojo', () => {
    const [caso] = armarCasos(
      {
        pines: [pin('r1', { tipo: 'rojo' })],
        solicitudes: [],
        encontrados: [pin('v7', { vinculadoA: 'r1' })],
      },
      'yo',
    )
    expect(accionPendiente(caso)).toBe('reclamar')
    expect(resumenCaso(caso)).toMatch(/Alguien lo encontró/)
  })
})

describe('accionPendiente, casoCerrado y resumenCaso', () => {
  const encontre = (solicitudes, cambios) => ({
    papel: 'encontre',
    pin: pin('v1', cambios),
    solicitudes,
  })
  const reclame = (cambios) => ({
    papel: 'reclame',
    pin: pin('v1'),
    solicitud: solicitud('s1', cambios),
  })

  it('quien encontró: responder, luego entregar', () => {
    expect(accionPendiente(encontre([solicitud('a'), solicitud('b')]))).toBe('responder')
    expect(resumenCaso(encontre([solicitud('a'), solicitud('b')]))).toBe(
      '2 solicitudes por revisar',
    )
    const enEntrega = encontre([solicitud('a', { estado: 'aceptada' })], { estado: 'aceptado' })
    expect(accionPendiente(enEntrega)).toBe('entregar')
    expect(accionPendiente(encontre([], {}))).toBeNull()
    expect(resumenCaso(encontre([], {}))).toMatch(/nadie lo ha reclamado/)
  })

  it('el dueño: esperar, luego pedir la clave; al entregar se cierra', () => {
    expect(accionPendiente(reclame())).toBeNull()
    expect(casoCerrado(reclame())).toBe(false)
    expect(accionPendiente(reclame({ estado: 'aceptada' }))).toBe('clave')
    const entregado = reclame({ estado: 'aceptada', entregada: '2026-10-25' })
    expect(accionPendiente(entregado)).toBeNull()
    expect(casoCerrado(entregado)).toBe(true)
    expect(resumenCaso(entregado)).toBe('Lo recuperaste')
    expect(resumenCaso(reclame({ estado: 'impostor' }))).toMatch(/strike/)
    expect(casoCerrado(reclame({ estado: 'rechazada' }))).toBe(true)
  })

  it('pines entregados quedan cerrados', () => {
    expect(casoCerrado(encontre([], { estado: 'entregado' }))).toBe(true)
    expect(
      resumenCaso({ papel: 'perdi', pin: pin('r1', { tipo: 'rojo', estado: 'entregado' }) }),
    ).toBe('Lo recuperaste')
  })
})

describe('Fase 4: puntos seguros, caducidad y renovación', () => {
  const ahora = new Date('2026-10-24T12:00:00Z')
  const hace = (dias) => new Date(ahora.getTime() - dias * 86400000).toISOString()
  const encontre = (cambios, solicitudes = []) => ({
    papel: 'encontre',
    pin: pin('v1', cambios),
    solicitudes,
    punto: 'Biblioteca (AF)',
  })
  const perdi = (cambios, encontrados = []) => ({
    papel: 'perdi',
    pin: pin('r1', { tipo: 'rojo', ...cambios }),
    encontrados,
  })

  it('un pin verde vencido pide llevarlo a un punto seguro', () => {
    const caso = encontre({ estado: 'caducado', expira: hace(1) })
    expect(accionPendiente(caso, ahora)).toBe('llevar')
    expect(casoCerrado(caso, ahora)).toBe(false)
    expect(resumenCaso(caso, ahora)).toMatch(/llévalo a un punto seguro/)
  })

  it('en camino espera la confirmación; en resguardo, quien lo encontró queda deslindado', () => {
    const enCamino = encontre({ estado: 'en_camino' })
    expect(accionPendiente(enCamino, ahora)).toBeNull()
    expect(casoCerrado(enCamino, ahora)).toBe(false)
    expect(resumenCaso(enCamino, ahora)).toMatch(/Llévalo a Biblioteca \(AF\)/)
    // Aunque vea solicitudes del objeto, ya no le toca responderlas
    const resguardo = encontre({ estado: 'en_resguardo' }, [solicitud('s1')])
    expect(accionPendiente(resguardo, ahora)).toBeNull()
    expect(casoCerrado(resguardo, ahora)).toBe(true)
    expect(resumenCaso(resguardo, ahora)).toMatch(/ya no es tu responsabilidad/)
    expect(resumenCaso(encontre({ estado: 'no_reclamado' }), ahora)).toMatch(/Nadie lo reclamó/)
  })

  it('un pin rojo vencido se renueva una vez y sigue en "Se busca" 30 días', () => {
    const vencido = perdi({ estado: 'caducado', expira: hace(2) })
    expect(accionPendiente(vencido, ahora)).toBe('renovar')
    expect(resumenCaso(vencido, ahora)).toMatch(/"Se busca" 28 días más\. Puedes renovarlo/)
    const yaRenovado = perdi({ estado: 'caducado', expira: hace(2), renovado: true })
    expect(accionPendiente(yaRenovado, ahora)).toBeNull()
    expect(casoCerrado(yaRenovado, ahora)).toBe(false)
    expect(resumenCaso(yaRenovado, ahora)).toBe('Venció: sigue en "Se busca" 28 días más')
    const fuera = perdi({ estado: 'caducado', expira: hace(40), renovado: true })
    expect(casoCerrado(fuera, ahora)).toBe(true)
  })

  it('si el verde vinculado caducó, el dueño todavía lo puede reclamar', () => {
    const caso = perdi({ estado: 'caducado', expira: hace(3) }, [pin('v9', { estado: 'caducado' })])
    expect(accionPendiente(caso, ahora)).toBe('reclamar')
  })

  it('"Lo encontré" desde "Se busca" también pide reclamar', () => {
    const caso = perdi({ estado: 'caducado', expira: hace(3) }, [pin('v9', { estado: 'activo' })])
    expect(accionPendiente(caso, ahora)).toBe('reclamar')
  })

  it('el dueño de un objeto en resguardo lo recoge en el punto seguro', () => {
    const caso = {
      papel: 'reclame',
      pin: pin('v1', { estado: 'en_resguardo' }),
      solicitud: solicitud('s1', { estado: 'aceptada', solicitanteId: 'yo' }),
      punto: 'Biblioteca (AF)',
    }
    expect(accionPendiente(caso, ahora)).toBe('clave')
    expect(resumenCaso(caso, ahora)).toMatch(/recógelo en Biblioteca \(AF\)/)
    const pendiente = { ...caso, solicitud: solicitud('s1', { solicitanteId: 'yo' }) }
    expect(resumenCaso(pendiente, ahora)).toBe('Esperando respuesta de Biblioteca (AF)')
  })

  it('armarCasos pone el nombre del punto seguro', () => {
    const [caso] = armarCasos(
      {
        pines: [pin('v1', { estado: 'en_camino', puntoSeguroId: 'p1' })],
        solicitudes: [],
        puntos: [{ id: 'p1', nombre: 'Biblioteca (AF)' }],
      },
      'yo',
    )
    expect(caso.punto).toBe('Biblioteca (AF)')
  })
})

describe('textoAviso', () => {
  it('usa el título del objeto', () => {
    expect(textoAviso({ tipo: 'reclamaron_mi_objeto', titulo: 'Termo' })).toMatch(/"Termo" es suyo/)
    expect(textoAviso({ tipo: 'lo_encontraron', titulo: null })).toMatch(/"tu objeto"/)
    expect(textoAviso({ tipo: 'desconocido' })).toBe('Tienes un aviso nuevo.')
    // Un rechazo por impostor se avisa como strike
    expect(
      textoAviso({ tipo: 'solicitud_rechazada', titulo: 'Termo', solicitudEstado: 'impostor' }),
    ).toMatch(/recibiste un strike/)
    expect(
      textoAviso({ tipo: 'solicitud_rechazada', titulo: 'Termo', solicitudEstado: 'rechazada' }),
    ).toMatch(/no fue aceptada/)
  })
})
