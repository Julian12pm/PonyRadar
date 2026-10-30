// Validación de correos: solo se aceptan cuentas institucionales del ITM.
// La base de datos repite esta misma validación (Fase 2); esta es solo para el formulario.

export const DOMINIO_PERMITIDO = 'morelia.tecnm.mx'

/**
 * Indica si un correo pertenece al dominio @morelia.tecnm.mx.
 * Ignora mayúsculas y espacios al inicio o al final.
 * @param {string} correo
 * @returns {boolean}
 */
export function esCorreoInstitucional(correo) {
  if (typeof correo !== 'string') return false

  const limpio = correo.trim().toLowerCase()

  // Formato: algo@morelia.tecnm.mx, sin espacios y con una sola @
  const patron = /^[^\s@]+@morelia\.tecnm\.mx$/
  return patron.test(limpio)
}

/**
 * Buzón real de un correo: sin el "+alias" (l23121064+sec@… → l23121064@…). Solo se permite
 * una cuenta por buzón, salvo los alias que autorice el admin (lo revisa el servidor).
 */
export function buzonDe(correo) {
  return (correo ?? '')
    .trim()
    .toLowerCase()
    .replace(/^([^@+]*)\+[^@]*@/, '$1@')
}

/** ¿El correo trae un "+alias"? */
export function tieneAlias(correo) {
  const limpio = (correo ?? '').trim().toLowerCase()
  return limpio !== buzonDe(limpio)
}
