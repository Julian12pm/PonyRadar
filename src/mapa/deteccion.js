// Detección de zona: dado un punto del mapa (en metros), dice en qué edificio o área cayó.

import { JARDINES, ZONAS } from './zonas.js'
import { dentro } from './geometria.js'

const EDIFICIOS = ZONAS.filter((z) => z.tipo === 'edificio')
const EXTERIORES = ZONAS.filter((z) => z.tipo === 'exterior')

const dentroDeAlguno = (punto, poligonos) => poligonos.some((p) => dentro(punto, p))

/**
 * ¿El punto cae sobre el edificio tal como se ve dibujado? Los edificios tienen volumen:
 * el techo está `alto` metros más arriba que la base, así que se prueba la base, la mitad
 * de los muros y el techo.
 */
function tocaEdificio([x, y], zona) {
  return [0, zona.alto / 2, zona.alto].some((d) => dentroDeAlguno([x, y + d], zona.poligonos))
}

/**
 * Detecta la zona de un punto.
 * 1. Edificios: si el toque cae en dos (uno tapa al otro por el volumen), gana el de más al sur,
 *    que es el que se dibuja encima.
 * 2. Exteriores: si cae en varios (por ejemplo el campo dentro de la pista), gana el más chico.
 * 3. Si no cae en nada pero sí dentro de una unidad, son los jardines de esa unidad.
 * @param {[number, number]} punto en metros
 * @returns {object|null} la zona, o null si el punto está fuera del campus
 */
export function detectarZona(punto) {
  const edificios = EDIFICIOS.filter((z) => tocaEdificio(punto, z))
  if (edificios.length) return edificios.reduce((a, b) => (b.sur > a.sur ? b : a))

  const exteriores = EXTERIORES.filter((z) => dentroDeAlguno(punto, z.poligonos))
  if (exteriores.length) return exteriores.reduce((a, b) => (b.area < a.area ? b : a))

  return JARDINES.find((j) => dentroDeAlguno(punto, j.poligonos)) ?? null
}

/** Unidad (id) en la que cae un punto, o null si está fuera del campus. */
export function unidadDePunto(punto) {
  return JARDINES.find((j) => dentroDeAlguno(punto, j.poligonos))?.unidad ?? null
}
