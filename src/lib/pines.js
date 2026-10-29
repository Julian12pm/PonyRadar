// Pines guardados en Supabase: cargar, crear (con fotos) y escuchar cambios en tiempo real.
import { supabase } from './supabase.js'

/** Error con el mensaje de Supabase y su código de estado (para distinguir fallas de red). */
export function errorDe(error) {
  return Object.assign(new Error(error.message), { status: error.status, code: error.code })
}

// Estados con los que un pin se dibuja en el mapa (los demás van a otras listas en la Fase 4)
export const ESTADOS_EN_MAPA = ['activo', 'con_solicitud', 'aceptado']

export const COLUMNAS =
  'id, autor_id, tipo, categoria, titulo, descripcion, zona_id, piso, x, y, estado, creado_en, expira_en, renovado, foto_publica, tiene_foto_nitida, punto_seguro_id, pin_vinculado_id, encontrado'

/** Convierte una fila de la tabla "pines" al formato que usa la app. */
export function filaAPin(fila) {
  return {
    id: fila.id,
    autorId: fila.autor_id,
    tipo: fila.tipo,
    categoria: fila.categoria,
    titulo: fila.titulo,
    descripcion: fila.descripcion ?? '',
    zonaId: fila.zona_id,
    piso: fila.piso ?? '',
    punto: [fila.x, fila.y],
    estado: fila.estado,
    creado: fila.creado_en,
    expira: fila.expira_en,
    fotoPublica: fila.foto_publica ?? null,
    tieneFotoNitida: Boolean(fila.tiene_foto_nitida),
    renovado: Boolean(fila.renovado),
    puntoSeguroId: fila.punto_seguro_id ?? null,
    // "Lo encontré": el verde apunta a su rojo; el rojo queda "encontrado" mientras siga en curso
    pinVinculadoId: fila.pin_vinculado_id ?? null,
    encontrado: Boolean(fila.encontrado),
  }
}

/**
 * ¿El pin se dibuja en el mapa? Los activos, mientras no pasen sus 72 h. Los que tienen una
 * solicitud pendiente o aceptada no caducan (especificación, sección 7), así que siguen visibles.
 */
export function seVeEnMapa(pin, ahora = new Date()) {
  // Un rojo que alguien ya encontró no se muestra: en su lugar está el verde vinculado
  if (pin.tipo === 'rojo' && pin.encontrado) return false
  if (pin.estado === 'activo') return new Date(pin.expira) > ahora
  return ESTADOS_EN_MAPA.includes(pin.estado)
}

/**
 * Agrega o reemplaza un pin en la lista (por id) y quita los que ya no se ven en el mapa.
 * Se usa al llegar un cambio en tiempo real.
 */
export function aplicarCambio(lista, pin, ahora = new Date()) {
  const sinEse = lista.filter((p) => p.id !== pin.id)
  return seVeEnMapa(pin, ahora) ? [...sinEse, pin] : sinEse
}

/** Pines visibles en el mapa. */
export async function cargarPines() {
  const { data, error } = await supabase
    .from('pines')
    .select(COLUMNAS)
    .or(
      `estado.in.(con_solicitud,aceptado),and(estado.eq.activo,expira_en.gt."${new Date().toISOString()}")`,
    )
    .eq('encontrado', false)
  if (error) throw errorDe(error)
  return data.map(filaAPin)
}

/**
 * Escucha pines nuevos y cambios. Llama a alCambiar(pin) con cada uno, y a alEstado con
 * 'conectado' o 'desconectado' cuando cambia la conexión en tiempo real.
 * @returns {() => void} función para dejar de escuchar
 */
export function escucharPines(alCambiar, alEstado = () => {}) {
  const canal = supabase
    .channel('pines-del-mapa')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pines' }, (cambio) => {
      if (cambio.new?.id) alCambiar(filaAPin(cambio.new))
    })
    .subscribe((estado) => {
      if (estado === 'SUBSCRIBED') alEstado('conectado')
      else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(estado)) alEstado('desconectado')
    })
  return () => supabase.removeChannel(canal)
}

/**
 * Crea un pin con la función RPC crear_pin y, si hay fotos, las sube y las adjunta.
 * @param {{tipo, categoria, titulo, descripcion, piso, zonaId, punto, datoCiego?,
 *          fotos?: {publica: Blob, nitida?: Blob}}} datos
 * @returns {Promise<string>} id del pin nuevo
 */
export async function crearPin(datos) {
  const { data: id, error } = await supabase.rpc('crear_pin', {
    p_tipo: datos.tipo,
    p_categoria: datos.categoria,
    p_titulo: datos.titulo,
    p_descripcion: datos.descripcion ?? '',
    p_zona_id: datos.zonaId,
    p_piso: datos.piso ?? '',
    p_x: datos.punto[0],
    p_y: datos.punto[1],
    p_dato_ciego: datos.tipo === 'verde' ? datos.datoCiego : null,
  })
  if (error) throw errorDe(error)

  if (datos.fotos?.publica) {
    const subir = (nombre, archivo) =>
      supabase.storage.from('fotos').upload(`${id}/${nombre}`, archivo, {
        contentType: 'image/webp',
      })
    const subidas = [subir('publica.webp', datos.fotos.publica)]
    if (datos.fotos.nitida) subidas.push(subir('nitida.webp', datos.fotos.nitida))
    const resultados = await Promise.all(subidas)
    const fallo = resultados.find((r) => r.error)
    // El pin ya existe aunque falle la foto: se avisa, pero no se pierde el reporte
    const { error: errorAdjuntar } = await supabase.rpc('adjuntar_fotos', { p_pin: id })
    if (fallo || errorAdjuntar) {
      throw new Error('El pin se publicó, pero la foto no se pudo subir.')
    }
  }
  return id
}

/** Enlace temporal (1 h) para ver una foto del bucket privado. */
export async function enlaceFoto(ruta) {
  const { data, error } = await supabase.storage.from('fotos').createSignedUrl(ruta, 3600)
  if (error) return null
  return data.signedUrl
}

/** Dato ciego de un pin verde (solo lo devuelve si el usuario es su autor; si no, null). */
export async function leerDatoCiego(pinId) {
  const { data } = await supabase
    .from('datos_ciegos')
    .select('dato')
    .eq('pin_id', pinId)
    .maybeSingle()
  return data?.dato ?? null
}

/** Puntos seguros activos y cuántos objetos tienen en resguardo. */
export async function cargarPuntosSeguros() {
  const [{ data: puntos, error }, { data: resguardados }] = await Promise.all([
    supabase.from('puntos_seguros').select('id, nombre, zona_id').eq('activo', true),
    supabase.from('pines').select('punto_seguro_id').eq('estado', 'en_resguardo'),
  ])
  if (error) throw errorDe(error)
  return puntos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    zonaId: p.zona_id,
    cantidad: (resguardados ?? []).filter((r) => r.punto_seguro_id === p.id).length,
  }))
}
