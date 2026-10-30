// Ayudas para sobrevivir a caídas de red o de Supabase: detectar el tipo de error,
// calcular cuánto esperar antes de reintentar y guardar una copia local de los datos.

export const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor, reintentando…'

/**
 * ¿El error es de conexión (sin internet, servidor caído o saturado)?
 * Los errores "normales" (por ejemplo, una regla de la base de datos) no se reintentan.
 */
export function esErrorDeRed(error) {
  if (!error) return false
  const estado = error.status ?? error.code
  if (
    estado === 0 ||
    [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(Number(estado))
  ) {
    return true
  }
  const texto = `${error.name ?? ''} ${error.message ?? ''}`
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout|timed out|abort|err_connection|econnrefused|enotfound/i.test(
    texto,
  )
}

/**
 * Espera antes del siguiente reintento: crece al doble cada vez (1 s, 2 s, 4 s…) hasta un tope.
 * `azar` (0 a 1) agrega hasta 20 % de variación para que no reintenten todos a la vez.
 */
export function esperaReintento(intento, { base = 1000, maximo = 30000, azar = 0 } = {}) {
  const sinVariacion = Math.min(maximo, base * 2 ** intento)
  return Math.round(sinVariacion * (1 + 0.2 * azar))
}

// ─── Copia local (localStorage) ───
// Si el almacenamiento no está disponible (modo privado, lleno), simplemente no se guarda.

export function guardarLocal(clave, valor, almacen = globalThis.localStorage) {
  try {
    almacen?.setItem(clave, JSON.stringify({ guardado: new Date().toISOString(), valor }))
  } catch {
    // Sin espacio o sin permiso: la app sigue funcionando sin copia local
  }
}

/** @returns {{guardado: string, valor: any} | null} */
export function leerLocal(clave, almacen = globalThis.localStorage) {
  try {
    const texto = almacen?.getItem(clave)
    return texto ? JSON.parse(texto) : null
  } catch {
    return null
  }
}

export function borrarLocal(clave, almacen = globalThis.localStorage) {
  try {
    almacen?.removeItem(clave)
  } catch {
    // nada que hacer
  }
}
