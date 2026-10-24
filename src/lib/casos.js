// Casos de reclamo y entrega: "Es mío", "Lo encontré", aceptar/rechazar, clave de liberación,
// contacto por Teams y avisos. Todo lo sensible lo hace el servidor con funciones RPC.
import { COLUMNAS, errorDe, filaAPin } from './pines.js'
import { supabase } from './supabase.js'

// Nunca "*": la columna clave_hash no se puede leer (y pedirla da error de permisos)
const COLUMNAS_SOLICITUD =
  'id, pin_id, solicitante_id, respuesta, estado, creado_en, resuelta_en, intentos_clave, aceptada_en, entregada_en, clave_generada_en'

export const MAXIMO_INTENTOS = 5

/** Convierte una fila de "solicitudes" al formato de la app. */
export function filaASolicitud(fila) {
  return {
    id: fila.id,
    pinId: fila.pin_id,
    solicitanteId: fila.solicitante_id,
    respuesta: fila.respuesta,
    estado: fila.estado,
    creada: fila.creado_en,
    resuelta: fila.resuelta_en,
    intentos: fila.intentos_clave ?? 0,
    aceptada: fila.aceptada_en,
    entregada: fila.entregada_en,
    claveGenerada: fila.clave_generada_en,
    pin: fila.pin ? filaAPin(fila.pin) : null,
  }
}

async function llamar(funcion, parametros) {
  const { data, error } = await supabase.rpc(funcion, parametros)
  if (error) throw errorDe(error)
  return data
}

// ─── Acciones ───

/** "Es mío": envía lo que el reclamante cree que es el dato ciego. @returns id de la solicitud */
export const solicitarPin = (pinId, respuesta) =>
  llamar('solicitar_pin', { p_pin: pinId, p_respuesta: respuesta.trim() })

/** @param {'aceptar'|'rechazar'|'impostor'} decision */
export const responderSolicitud = (solicitudId, decision) =>
  llamar('responder_solicitud', { p_solicitud: solicitudId, p_decision: decision })

/** El dueño pide su clave de 4 dígitos (se muestra una vez; si la olvida, pide otra). */
export const generarClave = (solicitudId) => llamar('generar_clave', { p_solicitud: solicitudId })

/**
 * Quien tiene el objeto escribe la clave que le dicta el dueño.
 * @returns {Promise<{ok: boolean, intentosRestantes: number}>}
 */
export async function verificarClave(solicitudId, clave) {
  const r = await llamar('verificar_clave', { p_solicitud: solicitudId, p_clave: clave.trim() })
  return { ok: Boolean(r?.ok), intentosRestantes: r?.intentos_restantes ?? 0 }
}

/** Nombre y correo de la otra parte (solo después de aceptar). */
export async function contactoDelCaso(solicitudId) {
  const filas = await llamar('contacto_del_caso', { p_solicitud: solicitudId })
  return filas?.[0] ?? null
}

/** "Lo encontré" en un pin rojo: crea un pin verde vinculado. @returns id del pin verde */
export const loEncontre = (pinRojoId, { descripcion = '', piso = '', datoCiego }) =>
  llamar('lo_encontre', {
    p_pin_rojo: pinRojoId,
    p_descripcion: descripcion,
    p_piso: piso,
    p_dato_ciego: datoCiego,
  })

// ─── Mis casos ───

/**
 * Junta mis pines y las solicitudes que veo (las mías y las de mis pines) en una lista de casos.
 * Papel: 'encontre' (mi pin verde), 'perdi' (mi pin rojo) o 'reclame' (mi solicitud a otro pin).
 */
export function armarCasos({ pines, solicitudes, encontrados = [] }, yo) {
  const casos = pines.map((pin) => ({
    id: `pin-${pin.id}`,
    papel: pin.tipo === 'verde' ? 'encontre' : 'perdi',
    pin,
    solicitudes: solicitudes.filter((s) => s.pinId === pin.id && s.solicitanteId !== yo),
    // Pines verdes que alguien creó con "Lo encontré" sobre mi pin rojo
    encontrados: encontrados.filter((v) => v.vinculadoA === pin.id),
  }))
  for (const s of solicitudes) {
    if (s.solicitanteId === yo && s.pin) {
      casos.push({ id: `sol-${s.id}`, papel: 'reclame', pin: s.pin, solicitud: s })
    }
  }
  const prioridad = (c) => (accionPendiente(c) ? 0 : casoCerrado(c) ? 2 : 1)
  return casos.sort(
    (a, b) => prioridad(a) - prioridad(b) || fechaDelCaso(b).localeCompare(fechaDelCaso(a)),
  )
}

function fechaDelCaso(caso) {
  return caso.solicitud?.creada ?? caso.pin.creado ?? ''
}

/** Solicitud aceptada que espera la entrega (para quien encontró). */
export function solicitudEnEntrega(caso) {
  return caso.solicitudes?.find((s) => s.estado === 'aceptada' && !s.entregada) ?? null
}

/**
 * Lo que el usuario tiene que hacer ahora en el caso, o null:
 * 'responder' (hay solicitudes por revisar), 'entregar' (escribir la clave del dueño),
 * 'clave' (el dueño debe pedir su clave y verse con quien lo tiene), 'reclamar' (alguien
 * encontró mi objeto perdido).
 */
export function accionPendiente(caso) {
  if (caso.papel === 'encontre') {
    if (solicitudEnEntrega(caso)) return 'entregar'
    if (caso.solicitudes.some((s) => s.estado === 'pendiente')) return 'responder'
    return null
  }
  if (caso.papel === 'reclame') {
    const s = caso.solicitud
    return s.estado === 'aceptada' && !s.entregada ? 'clave' : null
  }
  const activos = caso.encontrados?.filter((v) => ['activo', 'con_solicitud'].includes(v.estado))
  return caso.pin.estado === 'activo' && activos?.length ? 'reclamar' : null
}

export function casoCerrado(caso) {
  if (caso.papel === 'reclame') {
    return caso.solicitud.estado !== 'pendiente' && !accionPendiente(caso)
  }
  return ['entregado', 'caducado', 'no_reclamado'].includes(caso.pin.estado)
}

/** Frase corta con el estado del caso, desde el punto de vista del usuario. */
export function resumenCaso(caso) {
  if (caso.papel === 'reclame') {
    const s = caso.solicitud
    if (s.entregada) return 'Lo recuperaste'
    return (
      {
        pendiente: 'Esperando respuesta de quien lo encontró',
        aceptada: 'Aceptaron tu solicitud: pide tu clave y quédense de ver',
        rechazada: 'Tu solicitud fue rechazada',
        impostor: 'Rechazada por no coincidir con el dato ciego (+1 strike)',
        cancelada: 'Solicitud cancelada',
      }[s.estado] ?? s.estado
    )
  }
  const accion = accionPendiente(caso)
  if (accion === 'entregar') return 'Aceptaste una solicitud: espera la clave del dueño'
  if (accion === 'responder') {
    const n = caso.solicitudes.filter((s) => s.estado === 'pendiente').length
    return n === 1 ? '1 solicitud por revisar' : `${n} solicitudes por revisar`
  }
  if (accion === 'reclamar') return 'Alguien lo encontró: revisa si es tuyo'
  const estado = caso.pin.estado
  if (estado === 'entregado') return caso.papel === 'perdi' ? 'Lo recuperaste' : 'Entregado'
  if (estado === 'caducado') return 'Venció: pasaron 72 horas'
  if (estado === 'activo') {
    return caso.papel === 'perdi'
      ? 'Publicado: nadie lo ha encontrado aún'
      : 'Publicado: nadie lo ha reclamado aún'
  }
  return estado.replace('_', ' ')
}

/** Carga mis casos: mis pines, las solicitudes que veo y los "Lo encontré" de mis pines rojos. */
export async function cargarCasos(yo) {
  const [pines, solicitudes] = await Promise.all([
    supabase
      .from('pines')
      .select(COLUMNAS)
      .eq('autor_id', yo)
      .order('creado_en', { ascending: false })
      .limit(50),
    supabase
      .from('solicitudes')
      .select(`${COLUMNAS_SOLICITUD}, pin:pines(${COLUMNAS})`)
      .order('creado_en', { ascending: false })
      .limit(100),
  ])
  if (pines.error) throw errorDe(pines.error)
  if (solicitudes.error) throw errorDe(solicitudes.error)

  const mios = pines.data.map(filaAPin)
  const rojos = mios.filter((p) => p.tipo === 'rojo').map((p) => p.id)
  let encontrados = []
  if (rojos.length) {
    const { data, error } = await supabase
      .from('pines')
      .select(`${COLUMNAS}, pin_vinculado_id`)
      .in('pin_vinculado_id', rojos)
    if (error) throw errorDe(error)
    encontrados = data.map((f) => ({ ...filaAPin(f), vinculadoA: f.pin_vinculado_id }))
  }
  return armarCasos(
    { pines: mios, solicitudes: solicitudes.data.map(filaASolicitud), encontrados },
    yo,
  )
}

/** Mi solicitud pendiente o aceptada a un pin (para no ofrecer "Es mío" dos veces). */
export async function miSolicitudAlPin(pinId, yo) {
  const { data, error } = await supabase
    .from('solicitudes')
    .select(COLUMNAS_SOLICITUD)
    .eq('pin_id', pinId)
    .eq('solicitante_id', yo)
    .in('estado', ['pendiente', 'aceptada'])
    .maybeSingle()
  if (error) throw errorDe(error)
  return data ? filaASolicitud(data) : null
}

// ─── Avisos ───

const TEXTO_AVISO = {
  reclamaron_mi_objeto: (t) => `Alguien dice que "${t}" es suyo. Revisa su respuesta.`,
  solicitud_aceptada: (t) => `Aceptaron tu solicitud de "${t}". Pide tu clave de entrega.`,
  solicitud_rechazada: (t) => `Tu solicitud de "${t}" no fue aceptada.`,
  lo_encontraron: (t) => `Alguien encontró "${t}". Si es tuyo, pulsa "Es mío".`,
  coincidencia: (t) => `Encontraron algo parecido a "${t}" en la misma zona.`,
  punto_seguro_sin_confirmar: (t) => `El punto seguro no ha confirmado "${t}".`,
}

/** Texto del aviso para la lista (usa el título del pin si se conoce). */
export function textoAviso(aviso) {
  const texto = TEXTO_AVISO[aviso.tipo]
  return texto ? texto(aviso.titulo ?? 'tu objeto') : 'Tienes un aviso nuevo.'
}

export function filaAAviso(fila) {
  return {
    id: fila.id,
    tipo: fila.tipo,
    pinId: fila.pin_id,
    solicitudId: fila.solicitud_id,
    leido: fila.leido,
    creado: fila.creado_en,
    titulo: fila.pin?.titulo ?? null,
  }
}

export async function cargarAvisos() {
  const { data, error } = await supabase
    .from('avisos')
    .select('id, tipo, pin_id, solicitud_id, leido, creado_en, pin:pines(titulo)')
    .order('creado_en', { ascending: false })
    .limit(30)
  if (error) throw errorDe(error)
  return data.map(filaAAviso)
}

export async function marcarAvisosLeidos(ids) {
  if (!ids.length) return
  const { error } = await supabase.from('avisos').update({ leido: true }).in('id', ids)
  if (error) throw errorDe(error)
}

/**
 * Escucha avisos nuevos del usuario en tiempo real.
 * @returns {() => void} función para dejar de escuchar
 */
export function escucharAvisos(yo, alLlegar) {
  const canal = supabase
    .channel(`avisos-${yo}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'avisos', filter: `destinatario_id=eq.${yo}` },
      (cambio) => alLlegar(filaAAviso(cambio.new)),
    )
    .subscribe()
  return () => supabase.removeChannel(canal)
}
