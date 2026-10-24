// Enlace para abrir un chat de Microsoft Teams con la otra persona del caso.
// No hay chat dentro de la app: la conversación es por Teams (correo institucional).

/**
 * @param {string} correo correo institucional de la otra persona
 * @param {string} mensaje texto que aparece ya escrito en el chat
 * @returns {string} https://teams.microsoft.com/l/chat/0/0?users=<correo>&message=<texto>
 */
export function enlaceTeams(correo, mensaje = '') {
  const parametros = [`users=${encodeURIComponent(correo.trim().toLowerCase())}`]
  if (mensaje) parametros.push(`message=${encodeURIComponent(mensaje)}`)
  return `https://teams.microsoft.com/l/chat/0/0?${parametros.join('&')}`
}

/**
 * Mensaje inicial según quién escribe.
 * @param {'dueno'|'encontro'} papelDeLaOtraPersona papel de la persona a la que se escribe
 * @param {string} objeto título del pin
 */
export function mensajeInicial(papelDeLaOtraPersona, objeto) {
  return papelDeLaOtraPersona === 'encontro'
    ? `Hola, soy quien reclamó "${objeto}" en PonyRadar. ¿Cuándo y dónde nos vemos para la entrega?`
    : `Hola, te escribo de PonyRadar: tengo "${objeto}". ¿Cuándo y dónde nos vemos para entregártelo?`
}
