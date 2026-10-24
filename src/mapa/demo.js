// Pines de prueba en memoria (Fase 1). En la Fase 2 se reemplazan por los pines de Supabase.

import campus from './campus-osm.json'
import { caja } from './geometria.js'

/** Punto frente a la cara sur de un edificio (donde suele estar la entrada). */
function frenteA(clave, dx = 0, dy = 6) {
  const e = campus.edificios.find((x) => x.clave === clave)
  const { x0, x1, y1 } = caja(e.puntos)
  return [(x0 + x1) / 2 + dx, y1 + dy]
}

export const PINES_DEMO = [
  { id: 'p1', tipo: 'rojo', punto: frenteA('CH') },
  { id: 'p2', tipo: 'rojo', punto: frenteA('E', -6) },
  { id: 'p3', tipo: 'verde', punto: frenteA('R', 4) },
  { id: 'p4', tipo: 'verde', punto: frenteA('Q', 8, 10) },
  { id: 'p5', tipo: 'rojo', punto: frenteA('J') },
  { id: 'p6', tipo: 'verde', punto: frenteA('AH', 30, 14) },
  { id: 'p7', tipo: 'rojo', punto: frenteA('2D') },
]

export const GRUPOS_DEMO = [{ id: 'g1', cantidad: 4, punto: frenteA('U', 0, 10) }]

export const SEGUROS_DEMO = [{ id: 's1', cantidad: 3, punto: frenteA('AF', 0, 7) }]
