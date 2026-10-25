// Datos y acciones de los paneles de punto seguro y de admin.
// Lo sensible (recepción, solicitudes, clave, roles, personal, strikes) va por RPC;
// el admin edita directo puntos seguros y semestres (lo limita RLS).
import { COLUMNAS, errorDe, filaAPin } from './pines.js'
import { COLUMNAS_SOLICITUD, filaASolicitud } from './casos.js'
import { supabase } from './supabase.js'

async function llamar(funcion, parametros) {
  const { data, error } = await supabase.rpc(funcion, parametros)
  if (error) throw errorDe(error)
  return data
}

function revisar({ data, error }) {
  if (error) throw errorDe(error)
  return data
}

/** ¿Muestra el acceso a cada panel? */
export const esAdmin = (perfil) => perfil?.rol === 'admin'
export const veaPanelPunto = (perfil) => ['punto_seguro', 'admin'].includes(perfil?.rol)

// ─── Panel de punto seguro ───

/**
 * Puntos seguros que atiende el usuario, con sus objetos en camino y en resguardo,
 * las solicitudes de esos objetos y sus datos ciegos.
 */
export async function cargarPanelPunto(yo) {
  const asignaciones = revisar(
    await supabase
      .from('personal_punto_seguro')
      .select('punto:puntos_seguros(id, nombre, zona_id)')
      .eq('perfil_id', yo),
  )
  const puntos = asignaciones.map((a) => a.punto).filter(Boolean)
  if (!puntos.length) return { puntos: [], objetos: [], solicitudes: [], datos: {}, semestres: [] }

  const ids = puntos.map((p) => p.id)
  const [pines, semestres] = await Promise.all([
    supabase
      .from('pines')
      .select(`${COLUMNAS}, en_camino_desde, en_resguardo_desde`)
      .in('punto_seguro_id', ids)
      .in('estado', ['en_camino', 'en_resguardo'])
      .order('creado_en', { ascending: false }),
    supabase.from('semestres').select('nombre, fecha_inicio, fecha_fin').order('fecha_inicio'),
  ])
  const objetos = revisar(pines).map((f) => ({
    ...filaAPin(f),
    enCaminoDesde: f.en_camino_desde,
    enResguardoDesde: f.en_resguardo_desde,
  }))
  const idsResguardo = objetos.filter((o) => o.estado === 'en_resguardo').map((o) => o.id)
  let solicitudes = []
  let datos = {}
  if (idsResguardo.length) {
    const [s, d] = await Promise.all([
      supabase
        .from('solicitudes')
        .select(COLUMNAS_SOLICITUD)
        .in('pin_id', idsResguardo)
        .in('estado', ['pendiente', 'aceptada'])
        .is('entregada_en', null),
      supabase.from('datos_ciegos').select('pin_id, dato').in('pin_id', idsResguardo),
    ])
    solicitudes = revisar(s).map(filaASolicitud)
    datos = Object.fromEntries(revisar(d).map((x) => [x.pin_id, x.dato]))
  }
  return { puntos, objetos, solicitudes, datos, semestres: revisar(semestres) }
}

export const confirmarRecepcion = (pinId) => llamar('confirmar_recepcion', { p_pin: pinId })
export const marcarNoReclamado = (pinId) => llamar('marcar_no_reclamado', { p_pin: pinId })

/**
 * Fecha desde la que se puede marcar "no reclamado": el fin del semestre en que se recibió
 * (null si se recibió fuera de cualquier semestre: se puede marcar ya).
 */
export function finDeSemestre(recibido, semestres) {
  if (!recibido) return null
  const dia = String(recibido).slice(0, 10)
  const semestre = semestres.find((s) => s.fecha_inicio <= dia && dia <= s.fecha_fin)
  return semestre?.fecha_fin ?? null
}

/** ¿Ya se puede marcar "no reclamado"? (el día siguiente al fin del semestre) */
export function puedeMarcarNoReclamado(recibido, semestres, ahora = new Date()) {
  const fin = finDeSemestre(recibido, semestres)
  if (!fin) return true
  const hoy = ahora.toISOString().slice(0, 10)
  return hoy > fin
}

// ─── Panel de admin ───

export async function buscarPerfiles(texto = '') {
  let consulta = supabase
    .from('perfiles')
    .select('id, correo, nombre, rol, suspendido_hasta, bloqueado, creado_en')
    .order('correo')
    .limit(50)
  const limpio = texto.trim().toLowerCase()
  if (limpio) consulta = consulta.ilike('correo', `%${limpio.replace(/[%_]/g, '')}%`)
  return revisar(await consulta)
}

/** Strikes de una persona (vigentes y quitados), con el objeto que intentó reclamar. */
export async function cargarStrikes(perfilId) {
  const filas = revisar(
    await supabase
      .from('strikes')
      .select('id, creado_en, quitado_en, solicitud:solicitudes(respuesta, pin:pines(titulo))')
      .eq('perfil_id', perfilId)
      .order('creado_en', { ascending: false }),
  )
  return filas.map((s) => ({
    id: s.id,
    creado: s.creado_en,
    quitado: s.quitado_en,
    respuesta: s.solicitud?.respuesta ?? '',
    objeto: s.solicitud?.pin?.titulo ?? 'objeto',
  }))
}

export const strikesVigentes = (perfilId) =>
  llamar('admin_strikes_vigentes', { p_perfil: perfilId })
export const cambiarRol = (perfilId, rol) =>
  llamar('admin_cambiar_rol', { p_perfil: perfilId, p_rol: rol })
export const quitarStrike = (strikeId) => llamar('admin_quitar_strike', { p_strike: strikeId })
export const desbloquear = (perfilId) => llamar('admin_desbloquear', { p_perfil: perfilId })
export const asignarPersonal = (puntoId, correo) =>
  llamar('admin_asignar_personal', { p_punto: puntoId, p_correo: correo })
export const quitarPersonal = (puntoId, perfilId) =>
  llamar('admin_quitar_personal', { p_punto: puntoId, p_perfil: perfilId })
export const regresarAActivo = (pinId) => llamar('regresar_a_activo', { p_pin: pinId })

/** Puntos seguros (activos e inactivos) con su personal. */
export async function cargarPuntosAdmin() {
  const [puntos, personal] = await Promise.all([
    supabase.from('puntos_seguros').select('id, nombre, zona_id, activo').order('nombre'),
    supabase.from('personal_punto_seguro').select('punto_id, perfil:perfiles(id, correo, nombre)'),
  ])
  const filas = revisar(personal)
  return revisar(puntos).map((p) => ({
    ...p,
    personal: filas.filter((f) => f.punto_id === p.id && f.perfil).map((f) => f.perfil),
  }))
}

export async function crearPuntoSeguro(nombre, zonaId) {
  revisar(await supabase.from('puntos_seguros').insert({ nombre: nombre.trim(), zona_id: zonaId }))
}

export async function activarPuntoSeguro(id, activo) {
  revisar(await supabase.from('puntos_seguros').update({ activo }).eq('id', id))
}

export async function cargarSemestres() {
  return revisar(
    await supabase
      .from('semestres')
      .select('id, nombre, fecha_inicio, fecha_fin')
      .order('fecha_inicio', { ascending: false }),
  )
}

export async function crearSemestre({ nombre, inicio, fin }) {
  revisar(
    await supabase
      .from('semestres')
      .insert({ nombre: nombre.trim(), fecha_inicio: inicio, fecha_fin: fin }),
  )
}

/** Objetos en camino (para regresar a activo los que nunca llegaron). */
export async function cargarEnCamino() {
  const filas = revisar(
    await supabase
      .from('pines')
      .select(`${COLUMNAS}, en_camino_desde`)
      .eq('estado', 'en_camino')
      .order('en_camino_desde'),
  )
  return filas.map((f) => ({ ...filaAPin(f), enCaminoDesde: f.en_camino_desde }))
}

/** Horas desde una fecha (para "lleva 26 h en camino"). */
export function horasDesde(fecha, ahora = new Date()) {
  return Math.floor((ahora.getTime() - new Date(fecha).getTime()) / 3600000)
}
