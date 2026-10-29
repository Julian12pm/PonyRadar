// Reglas de texto que también revisa el servidor (crear_pin, migración 0011).

export const MENSAJE_TITULO = 'El título debe tener entre 3 y 60 caracteres y al menos una letra.'

/** Título de pin válido: de 3 a 60 caracteres (sin contar espacios al inicio o al final) y con al menos una letra. */
export function tituloValido(titulo) {
  const limpio = (titulo ?? '').trim()
  return limpio.length >= 3 && limpio.length <= 60 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(limpio)
}
