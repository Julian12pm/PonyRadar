// Casos de reclamo y entrega: "Es mío", "Lo encontré", aceptar/rechazar, clave de liberación,
// contacto por Teams y avisos. Todo lo sensible lo hace el servidor con funciones RPC.
import { COLUMNAS, errorDe, filaAPin } from './pines.js'
import { debeLlevarseAPuntoSeguro, diasEnSeBusca, enSeBusca, puedeRenovar } from './reglas.js'
import { supabase } from './supabase.js'

// Nunca "*": la columna clave_hash no se puede leer (y pedirla da error de permisos)
export const COLUMNAS_SOLICITUD =
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

/** Quien encontró deja el objeto en un punto seguro (queda "en camino"). */
export const dejarEnPuntoSeguro = (pinId, puntoId) =>
  llamar('dejar_en_punto_seguro', { p_pin: pinId, p_punto: puntoId })

/** Renueva un pin rojo caducado 72 h más (una sola vez). */
export const renovarPin = (pinId) => llamar('renovar_pin', { p_pin: pinId })

/** Strikes vigentes del usuario (semestre actual, sin los que quitó el admin). */
export const misStrikes = () => llamar('mis_strikes')

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
export function armarCasos({ pines, solicitudes, encontrados = [], puntos = [] }, yo) {
  const nombrePunto = (pin) => puntos.find((p) => p.id === pin.puntoSeguroId)?.nombre ?? null
  const casos = pines.map((pin) => ({
    id: `pin-${pin.id}`,
    papel: pin.tipo === 'verde' ? 'encontre' : 'perdi',
    pin,
    solicitudes: solicitudes.filter((s) => s.pinId === pin.id && s.solicitanteId !== yo),
    // Pines verdes que alguien creó con "Lo encontré" sobre mi pin rojo
    encontrados: encontrados.filter((v) => v.vinculadoA === pin.id),
    punto: nombrePunto(pin),
  }))
  for (const s of solicitudes) {
    if (s.solicitanteId === yo && s.pin) {
      casos.push({
        id: `sol-${s.id}`,
        papel: 'reclame',
        pin: s.pin,
        solicitud: s,
        punto: nombrePunto(s.pin),
      })
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

// Estados en los que el objeto ya no está con quien lo encontró
const EN_PUNTO_SEGURO = ['en_camino', 'en_resguardo', 'no_reclamado']

/**
 * Lo que el usuario tiene que hacer ahora en el caso, o null:
 * 'responder' (hay solicitudes por revisar), 'entregar' (escribir la clave del dueño),
 * 'clave' (el dueño debe pedir su clave y verse con quien lo tiene), 'reclamar' (alguien
 * encontró mi objeto perdido), 'llevar' (mi pin verde venció: llevarlo a un punto seguro),
 * 'renovar' (mi pin rojo venció y aún puedo renovarlo).
 */
export function accionPendiente(caso, ahora = new Date()) {
  if (caso.papel === 'encontre') {
    // En un punto seguro, las solicitudes las atiende su personal
    if (EN_PUNTO_SEGURO.includes(caso.pin.estado)) return null
    if (solicitudEnEntrega(caso)) return 'entregar'
    if (caso.solicitudes.some((s) => s.estado === 'pendiente')) return 'responder'
    if (debeLlevarseAPuntoSeguro(caso.pin, ahora)) return 'llevar'
    return null
  }
  if (caso.papel === 'reclame') {
    const s = caso.solicitud
    return s.estado === 'aceptada' && !s.entregada ? 'clave' : null
  }
  const activos = caso.encontrados?.filter((v) =>
    ['activo', 'con_solicitud', 'en_resguardo'].includes(v.estado),
  )
  if (['activo', 'caducado'].includes(caso.pin.estado) && activos?.length) return 'reclamar'
  if (puedeRenovar(caso.pin, ahora)) return 'renovar'
  return null
}

export function casoCerrado(caso, ahora = new Date()) {
  if (caso.papel === 'reclame') {
    return caso.solicitud.estado !== 'pendiente' && !accionPendiente(caso, ahora)
  }
  if (accionPendiente(caso, ahora)) return false
  const { estado } = caso.pin
  if (estado === 'caducado') return caso.papel === 'perdi' && !enSeBusca(caso.pin, ahora)
  // Quien lo encontró queda deslindado al confirmarse el resguardo
  if (estado === 'en_resguardo') return true
  return ['entregado', 'no_reclamado'].includes(estado)
}

/** Frase corta con el estado del caso, desde el punto de vista del usuario. */
export function resumenCaso(caso, ahora = new Date()) {
  const punto = caso.punto ?? 'el punto seguro'
  if (caso.papel === 'reclame') {
    const s = caso.solicitud
    if (s.entregada) return 'Lo recuperaste'
    if (s.estado === 'aceptada' && caso.pin.estado === 'en_resguardo') {
      return `Aceptaron tu solicitud: recógelo en ${punto} y dicta tu clave`
    }
    if (s.estado === 'pendiente' && caso.pin.estado === 'en_resguardo') {
      return `Esperando respuesta de ${punto}`
    }
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
  const accion = accionPendiente(caso, ahora)
  if (accion === 'entregar') return 'Aceptaste una solicitud: espera la clave del dueño'
  if (accion === 'responder') {
    const n = caso.solicitudes.filter((s) => s.estado === 'pendiente').length
    return n === 1 ? '1 solicitud por revisar' : `${n} solicitudes por revisar`
  }
  if (accion === 'reclamar') return 'Alguien lo encontró: revisa si es tuyo'
  if (accion === 'llevar') return 'Venció sin entregarse: llévalo a un punto seguro'
  const dias = diasEnSeBusca(caso.pin, ahora)
  const enLista = dias === 1 ? '1 día más' : `${dias} días más`
  if (accion === 'renovar') {
    return `Venció: sigue en "Se busca" ${enLista}. Puedes renovarlo una vez.`
  }

  const estado = caso.pin.estado
  if (estado === 'entregado') return caso.papel === 'perdi' ? 'Lo recuperaste' : 'Entregado'
  if (estado === 'en_camino') return `Llévalo a ${punto}: esperando que confirmen que lo recibieron`
  if (estado === 'en_resguardo') return `En resguardo en ${punto}: ya no es tu responsabilidad`
  if (estado === 'no_reclamado') return 'Nadie lo reclamó este semestre'
  if (estado === 'caducado') {
    return enSeBusca(caso.pin, ahora) ? `Venció: sigue en "Se busca" ${enLista}` : 'Venció'
  }
  if (estado === 'activo') {
    return caso.papel === 'perdi'
      ? 'Publicado: nadie lo ha encontrado aún'
      : 'Publicado: nadie lo ha reclamado aún'
  }
  return estado.replace('_', ' ')
}

/** Carga mis casos: mis pines, las solicitudes que veo y los "Lo encontré" de mis pines rojos. */
export async function cargarCasos(yo) {
  const [pines, solicitudes, puntos] = await Promise.all([
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
    supabase.from('puntos_seguros').select('id, nombre'),
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
    {
      pines: mios,
      solicitudes: solicitudes.data.map(filaASolicitud),
      encontrados,
      puntos: puntos.data ?? [],
    },
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
  impostor: (t) => `Tu solicitud de "${t}" no coincidió con el dato ciego: recibiste un strike.`,
  lo_encontraron: (t) => `Alguien encontró "${t}". Si es tuyo, pulsa "Es mío".`,
  coincidencia: (t) => `Encontraron algo parecido a "${t}" en la misma zona.`,
  punto_seguro_sin_confirmar: (t) =>
    `El punto seguro aún no confirma que recibió "${t}". ¿Ya lo llevaste?`,
}

/** Texto del aviso para la lista (usa el título del pin si se conoce). */
export function textoAviso(aviso) {
  // Un rechazo por impostor se muestra como strike
  const tipo =
    aviso.tipo === 'solicitud_rechazada' && aviso.solicitudEstado === 'impostor'
      ? 'impostor'
      : aviso.tipo
  const texto = TEXTO_AVISO[tipo]
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
    solicitudEstado: fila.solicitud?.estado ?? null,
  }
}

export async function cargarAvisos() {
  const { data, error } = await supabase
    .from('avisos')
    .select(
      'id, tipo, pin_id, solicitud_id, leido, creado_en, pin:pines(titulo), solicitud:solicitudes(estado)',
    )
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

// ─── Listas "Se busca" y "En resguardo" ───

/**
 * Puntos seguros donde se puede dejar un objeto: activos y con al menos una persona que los
 * atienda (lo calcula el servidor, porque la comunidad no puede ver quién es el personal).
 */
export async function cargarPuntosDisponibles() {
  const { data, error } = await supabase.rpc('puntos_disponibles')
  if (error) throw errorDe(error)
  return data
}

/** Rojos caducados en los últimos 30 días y objetos en resguardo, con los puntos seguros. */
export async function cargarListas(ahora = new Date()) {
  const hace30 = new Date(ahora.getTime() - 30 * 86400000).toISOString()
  const [seBusca, enResguardo, puntos] = await Promise.all([
    supabase
      .from('pines')
      .select(COLUMNAS)
      .eq('tipo', 'rojo')
      .in('estado', ['activo', 'caducado'])
      .lte('expira_en', ahora.toISOString())
      .gt('expira_en', hace30)
      .order('expira_en', { ascending: false })
      .limit(100),
    supabase
      .from('pines')
      .select(COLUMNAS)
      .eq('estado', 'en_resguardo')
      .order('creado_en', { ascending: false })
      .limit(200),
    supabase.from('puntos_seguros').select('id, nombre').eq('activo', true),
  ])
  for (const r of [seBusca, enResguardo, puntos]) if (r.error) throw errorDe(r.error)
  return {
    seBusca: seBusca.data.map(filaAPin),
    enResguardo: enResguardo.data.map(filaAPin),
    puntos: puntos.data,
  }
}
