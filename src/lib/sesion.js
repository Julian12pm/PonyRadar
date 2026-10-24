// Sesión del usuario: inicio con código de 6 dígitos por correo (OTP) y su perfil.
import { useEffect, useState } from 'react'
import { esCorreoInstitucional } from './correo.js'
import { supabase } from './supabase.js'

/** Envía el código de 6 dígitos al correo. Crea la cuenta si es la primera vez. */
export async function enviarCodigo(correo) {
  const limpio = correo.trim().toLowerCase()
  if (!esCorreoInstitucional(limpio)) {
    throw new Error('Usa tu correo institucional @morelia.tecnm.mx')
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: limpio,
    options: { shouldCreateUser: true },
  })
  if (error) throw new Error(traducirErrorAuth(error))
}

/** Verifica el código que llegó por correo e inicia la sesión. */
export async function verificarCodigo(correo, codigo) {
  const { error } = await supabase.auth.verifyOtp({
    email: correo.trim().toLowerCase(),
    token: codigo.trim(),
    type: 'email',
  })
  if (error) throw new Error(traducirErrorAuth(error))
}

/** ¿El perfil puede crear pines? (no está suspendido ni bloqueado) */
export function puedePublicar(perfil, ahora = new Date()) {
  if (!perfil || perfil.bloqueado) return false
  return !perfil.suspendido_hasta || new Date(perfil.suspendido_hasta) <= ahora
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
}

/** Mensajes de Supabase Auth en lenguaje de la app. */
export function traducirErrorAuth(error) {
  const mensaje = error?.message ?? ''
  if (/expired|invalid/i.test(mensaje) && /token|otp/i.test(mensaje)) {
    return 'El código no es válido o ya expiró. Pide uno nuevo.'
  }
  if (/rate limit|security purposes|too many/i.test(mensaje)) {
    return 'Pediste demasiados códigos. Espera un momento y vuelve a intentar.'
  }
  if (/morelia\.tecnm\.mx/.test(mensaje)) return 'Usa tu correo institucional @morelia.tecnm.mx'
  if (/fetch|network/i.test(mensaje)) return 'Sin conexión. Revisa tu internet.'
  return mensaje || 'Algo salió mal. Intenta de nuevo.'
}

/**
 * Sesión actual y perfil del usuario (nombre y rol). Se actualiza al entrar o salir.
 * @returns {{cargando: boolean, sesion: object|null, perfil: object|null}}
 */
export function useSesion() {
  const [estado, setEstado] = useState({ cargando: true, sesion: null, perfil: null })

  useEffect(() => {
    let vigente = true
    const actualizar = async (sesion) => {
      let perfil = null
      if (sesion) {
        const { data } = await supabase
          .from('perfiles')
          .select('id, correo, nombre, rol, suspendido_hasta, bloqueado')
          .eq('id', sesion.user.id)
          .maybeSingle()
        perfil = data
      }
      if (vigente) setEstado({ cargando: false, sesion, perfil })
    }

    supabase.auth.getSession().then(({ data }) => actualizar(data.session))
    // Al entrar o salir. (Supabase pide no esperar otras llamadas dentro de este aviso,
    // por eso la consulta del perfil se hace fuera, con setTimeout.)
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setTimeout(() => actualizar(sesion), 0)
    })
    return () => {
      vigente = false
      data.subscription.unsubscribe()
    }
  }, [])

  return estado
}
