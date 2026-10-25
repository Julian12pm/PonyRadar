// Reglas de la sección 6 de la especificación: strikes, suspensión, caducidad y renovación.
// El servidor es quien las aplica (migración 0007); aquí están para mostrarlas en la app.

const DIA = 24 * 3600 * 1000
export const DIAS_SE_BUSCA = 30

/**
 * Castigo según los strikes del semestre vigente.
 * @returns {{tipo: 'ninguno'|'aviso'|'suspension'|'bloqueo', dias?: number}}
 */
export function castigoPorStrikes(strikes) {
  if (strikes >= 5) return { tipo: 'bloqueo' }
  if (strikes === 4) return { tipo: 'suspension', dias: 30 }
  if (strikes === 3) return { tipo: 'suspension', dias: 7 }
  if (strikes >= 1) return { tipo: 'aviso' }
  return { tipo: 'ninguno' }
}

/** Fecha corta en español: "31 oct". */
export function fechaCorta(fecha) {
  return new Date(fecha)
    .toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

/** Mensaje para quien tiene strikes (null si no tiene). */
export function mensajeStrikes(strikes, perfil, ahora = new Date()) {
  if (!strikes && !perfil?.bloqueado) return null
  if (perfil?.bloqueado) {
    return 'Tu cuenta está bloqueada hasta que el admin la revise. Puedes ver el mapa, pero no publicar ni reclamar.'
  }
  const suspendida = perfil?.suspendido_hasta && new Date(perfil.suspendido_hasta) > ahora
  const cuenta = strikes === 1 ? '1 strike' : `${strikes} strikes`
  if (suspendida) {
    return `Tienes ${cuenta} este semestre. Tu cuenta está suspendida hasta el ${fechaCorta(perfil.suspendido_hasta)}.`
  }
  const siguiente = castigoPorStrikes(strikes + 1)
  const despues =
    siguiente.tipo === 'bloqueo'
      ? 'Con uno más tu cuenta se bloquea.'
      : siguiente.tipo === 'suspension'
        ? `Con uno más se suspende tu cuenta ${siguiente.dias} días.`
        : ''
  return `Tienes ${cuenta} este semestre por reclamar objetos que no eran tuyos. ${despues}`.trim()
}

/** Por qué no puede publicar (para el modo solo lectura), o null si sí puede. */
export function motivoSuspension(perfil, ahora = new Date()) {
  if (!perfil) return null
  if (perfil.bloqueado)
    return 'Tu cuenta está bloqueada hasta que el admin la revise: puedes ver el mapa, pero no publicar.'
  if (perfil.suspendido_hasta && new Date(perfil.suspendido_hasta) > ahora) {
    return `Tu cuenta está suspendida hasta el ${fechaCorta(perfil.suspendido_hasta)}: puedes ver el mapa, pero no publicar.`
  }
  return null
}

/** ¿El pin rojo está en "Se busca"? (caducó hace menos de 30 días) */
export function enSeBusca(pin, ahora = new Date()) {
  if (pin.tipo !== 'rojo' || !['activo', 'caducado'].includes(pin.estado)) return false
  const expira = new Date(pin.expira).getTime()
  return expira <= ahora.getTime() && expira > ahora.getTime() - DIAS_SE_BUSCA * DIA
}

/** Días que le quedan en "Se busca". */
export function diasEnSeBusca(pin, ahora = new Date()) {
  const fin = new Date(pin.expira).getTime() + DIAS_SE_BUSCA * DIA
  return Math.max(0, Math.ceil((fin - ahora.getTime()) / DIA))
}

/** ¿El dueño puede renovar su pin rojo? (una sola vez, mientras está en "Se busca") */
export function puedeRenovar(pin, ahora = new Date()) {
  return !pin.renovado && enSeBusca(pin, ahora)
}

/** Pin verde que caducó sin entregarse: la app pide llevarlo a un punto seguro. */
export function debeLlevarseAPuntoSeguro(pin, ahora = new Date()) {
  return (
    pin.tipo === 'verde' &&
    (pin.estado === 'caducado' || (pin.estado === 'activo' && new Date(pin.expira) <= ahora))
  )
}
