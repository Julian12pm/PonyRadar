import { beforeEach, describe, it, expect, vi } from 'vitest'

// Cliente de Supabase simulado: registra las llamadas y devuelve lo que cada prueba indique
const simulado = vi.hoisted(() => {
  const subidas = []
  const llamadasRpc = []
  return {
    subidas,
    llamadasRpc,
    respuestasRpc: {},
    falloSubida: false,
    cliente: {
      rpc: async (nombre, parametros) => {
        llamadasRpc.push({ nombre, parametros })
        return simulado.respuestasRpc[nombre] ?? { data: null, error: null }
      },
      storage: {
        from: () => ({
          upload: async (ruta) => {
            subidas.push(ruta)
            return { error: simulado.falloSubida ? { message: 'falló' } : null }
          },
        }),
      },
    },
  }
})
vi.mock('./supabase.js', () => ({ supabase: simulado.cliente, configurado: true }))

const { aplicarCambio, crearPin, filaAPin, seVeEnMapa } = await import('./pines.js')

const fila = {
  id: 'p1',
  autor_id: 'u1',
  tipo: 'verde',
  categoria: 'llaves',
  titulo: 'Llavero',
  descripcion: null,
  zona_id: 'edificio-K',
  piso: '',
  x: 10.5,
  y: -20,
  estado: 'activo',
  creado_en: '2026-10-24T10:00:00Z',
  expira_en: '2026-10-27T10:00:00Z',
  foto_publica: null,
  tiene_foto_nitida: false,
}
const ahora = new Date('2026-10-25T10:00:00Z')

describe('filaAPin', () => {
  it('convierte la fila de la base de datos al formato de la app', () => {
    const pin = filaAPin(fila)
    expect(pin).toMatchObject({
      id: 'p1',
      autorId: 'u1',
      zonaId: 'edificio-K',
      punto: [10.5, -20],
      descripcion: '',
      fotoPublica: null,
      tieneFotoNitida: false,
    })
  })
})

describe('seVeEnMapa', () => {
  it('muestra pines activos que no han caducado', () => {
    expect(seVeEnMapa(filaAPin(fila), ahora)).toBe(true)
  })

  it('oculta los caducados (más de 72 h) y los de estados que no van en el mapa', () => {
    expect(seVeEnMapa(filaAPin({ ...fila, expira_en: '2026-10-25T09:00:00Z' }), ahora)).toBe(false)
    expect(seVeEnMapa(filaAPin({ ...fila, estado: 'entregado' }), ahora)).toBe(false)
    expect(seVeEnMapa(filaAPin({ ...fila, estado: 'en_resguardo' }), ahora)).toBe(false)
  })

  it('los que tienen solicitud pendiente o aceptada no caducan', () => {
    const vencido = { ...fila, expira_en: '2026-10-25T09:00:00Z' }
    expect(seVeEnMapa(filaAPin({ ...vencido, estado: 'con_solicitud' }), ahora)).toBe(true)
    expect(seVeEnMapa(filaAPin({ ...vencido, estado: 'aceptado' }), ahora)).toBe(true)
  })
})

describe('aplicarCambio (tiempo real)', () => {
  const pin = filaAPin(fila)
  it('agrega un pin nuevo y reemplaza uno existente', () => {
    expect(aplicarCambio([], pin, ahora)).toHaveLength(1)
    const cambiado = { ...pin, titulo: 'Llavero rojo' }
    expect(aplicarCambio([pin], cambiado, ahora)).toEqual([cambiado])
  })

  it('quita el pin cuando deja de verse en el mapa', () => {
    expect(aplicarCambio([pin], { ...pin, estado: 'entregado' }, ahora)).toEqual([])
  })
})

describe('crearPin', () => {
  beforeEach(() => {
    simulado.subidas.length = 0
    simulado.llamadasRpc.length = 0
    simulado.falloSubida = false
    simulado.respuestasRpc = { crear_pin: { data: 'nuevo-id', error: null } }
  })

  const datos = {
    tipo: 'verde',
    categoria: 'llaves',
    titulo: 'Llavero',
    descripcion: '',
    piso: '',
    zonaId: 'edificio-K',
    punto: [1, 2],
    datoCiego: 'Llave morada',
  }

  it('llama a crear_pin con el dato ciego y sin fotos no sube nada', async () => {
    await expect(crearPin(datos)).resolves.toBe('nuevo-id')
    expect(simulado.llamadasRpc[0]).toMatchObject({
      nombre: 'crear_pin',
      parametros: {
        p_tipo: 'verde',
        p_zona_id: 'edificio-K',
        p_x: 1,
        p_y: 2,
        p_dato_ciego: 'Llave morada',
      },
    })
    expect(simulado.subidas).toEqual([])
  })

  it('un pin rojo nunca manda dato ciego', async () => {
    await crearPin({ ...datos, tipo: 'rojo' })
    expect(simulado.llamadasRpc[0].parametros.p_dato_ciego).toBeNull()
  })

  it('sube la foto pública y la nítida en la carpeta del pin y las adjunta', async () => {
    await crearPin({ ...datos, fotos: { publica: new Blob(), nitida: new Blob() } })
    expect(simulado.subidas).toEqual(['nuevo-id/publica.webp', 'nuevo-id/nitida.webp'])
    expect(simulado.llamadasRpc.at(-1)).toEqual({
      nombre: 'adjuntar_fotos',
      parametros: { p_pin: 'nuevo-id' },
    })
  })

  it('si la base de datos rechaza el pin, lanza su mensaje', async () => {
    simulado.respuestasRpc.crear_pin = {
      data: null,
      error: { message: 'Tu cuenta está suspendida' },
    }
    await expect(crearPin(datos)).rejects.toThrow('Tu cuenta está suspendida')
  })

  it('si falla la foto, avisa que el pin sí se publicó', async () => {
    simulado.falloSubida = true
    await expect(crearPin({ ...datos, fotos: { publica: new Blob() } })).rejects.toThrow(
      'El pin se publicó, pero la foto no se pudo subir.',
    )
  })
})
