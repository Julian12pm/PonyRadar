// Zonas del campus donde puede caer un toque. Se arman a partir de los datos de OpenStreetMap
// (campus-osm.json), así que cada zona tiene la forma real del edificio o del área.
//
// Cada zona: { id, tipo: 'edificio' | 'exterior', nombre, unidad, poligonos: [[[x, y], …], …] }
//   - Edificios: id = edificio-<letra> (edificio-K, edificio-2A, edificio-Ponyplaza…).
//     Llevan `clave` (la letra) y `alto` (metros), porque se dibujan con volumen.
//   - Exteriores: estacionamiento-5, estacionamiento-junto-AG, cancha-basquet-1, alberca,
//     pista, campo-pista, campo-futbol-ah, cancha-ptar…
//   - Jardines: lo que no es ninguna de las anteriores pero está dentro de una unidad
//     (jardin-unidad-central, jardin-unidad-metal-mecanica, jardin-unidad-posgrado).

import { EDIFICIOS, campus } from './campus.js'
import { area, caja, dentro } from './geometria.js'

/** Unidad (id) que contiene el centro de un polígono. */
function unidadDe(puntos) {
  const { x0, y0, x1, y1 } = caja(puntos)
  const centro = [(x0 + x1) / 2, (y0 + y1) / 2]
  return campus.unidades.find((u) => dentro(centro, u.puntos))?.id ?? null
}

/** Junta los polígonos que comparten id (el Estacionamiento 2 viene en dos partes). */
function agruparPorId(lista) {
  const porId = new Map()
  for (const z of lista) {
    if (!porId.has(z.id)) {
      porId.set(z.id, { id: z.id, subtipo: z.subtipo, nombre: z.nombre, poligonos: [] })
    }
    porId.get(z.id).poligonos.push(z.puntos)
  }
  return [...porId.values()]
}

const EDIFICIOS_ZONA = EDIFICIOS.map((e) => ({
  id: e.id,
  tipo: 'edificio',
  clave: e.clave,
  nombre: e.nombre,
  unidad: e.unidad,
  alto: e.alto,
  sur: e.sur, // orilla sur: entre dos edificios encimados, el más al sur se dibuja encima
  poligonos: [e.puntos],
}))

const EXTERIORES = [
  ...agruparPorId(campus.estacionamientos.map((e) => ({ ...e, subtipo: 'estacionamiento' }))),
  ...campus.canchas.map((c) => ({
    id: c.id,
    subtipo: 'cancha',
    nombre: c.nombre,
    poligonos: [c.puntos],
  })),
  ...campus.campos.map((c) => ({
    id: c.id,
    subtipo: 'campo',
    nombre: c.nombre,
    poligonos: [c.puntos],
  })),
  { id: 'alberca', subtipo: 'alberca', nombre: 'Alberca', poligonos: [campus.alberca.puntos] },
  {
    id: 'pista',
    subtipo: 'pista',
    nombre: 'Pista de atletismo',
    poligonos: [campus.pista.exterior],
  },
].map((z) => ({ ...z, tipo: 'exterior', unidad: unidadDe(z.poligonos[0]) }))

/** Jardines: la zona "de respaldo" de cada unidad. */
export const JARDINES = campus.unidades.map((u) => ({
  id: `jardin-${u.id}`,
  tipo: 'exterior',
  subtipo: 'jardin',
  nombre: `Jardines de la ${u.nombre}`,
  unidad: u.id,
  poligonos: [u.puntos],
}))

/** Todas las zonas con forma propia (edificios y exteriores), con su área ya calculada. */
export const ZONAS = [...EDIFICIOS_ZONA, ...EXTERIORES].map((z) => ({
  ...z,
  area: z.poligonos.reduce((s, p) => s + area(p), 0),
}))

/** Busca una zona por su id (también jardines). */
export function zonaPorId(id) {
  return ZONAS.find((z) => z.id === id) ?? JARDINES.find((z) => z.id === id) ?? null
}

/** Nombre corto para mostrar: "Edificio K", "Estacionamiento 5", "Jardines de la Unidad Central". */
export function nombreCorto(zona) {
  if (!zona) return 'Fuera del campus'
  if (zona.tipo === 'edificio')
    return zona.clave === 'Ponyplaza' ? 'Ponyplaza' : `Edificio ${zona.clave}`
  return zona.nombre
}
