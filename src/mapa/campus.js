// Datos del campus ya preparados para dibujar y para detectar zonas.
// Lee src/mapa/campus-osm.json (generado desde OpenStreetMap) y calcula, una sola vez,
// lo que no cambia: altura y punto de la etiqueta de cada edificio, calles con nombre, etc.

import campus from './campus-osm.json'
import { area, caja, puntoEtiqueta, rectanguloOrientado } from './geometria.js'

export { campus }

/** Área que cubre el dibujo, en metros. */
export const LIMITES = campus.limites

/** Altura (en metros) con la que se dibuja cada edificio. Un poco exagerada para que se lea. */
export const altoDe = (niveles) => 2.5 + 2.5 * niveles

// Edificios con letra, ordenados de norte a sur (los del sur tapan a los de atrás).
// `etiqueta` es el punto (en metros) donde va su letra, ya sobre el techo.
// `nivel` decide desde qué zoom aparece la letra: 1 = siempre, 2 = medianos, 3 = pequeños.
export const EDIFICIOS = campus.edificios
  .map((e) => {
    const alto = altoDe(e.niveles)
    const r = rectanguloOrientado(e.puntos)
    const [x, y] = puntoEtiqueta(e.puntos)
    const corto = Math.min(r.largo, r.ancho)
    const nivel = corto >= 13 ? 1 : corto >= 7 ? 2 : 3
    return { ...e, alto, etiqueta: [x, y - alto], nivel, sur: caja(e.puntos).y1 }
  })
  .sort((a, b) => a.sur - b.sur)

// Todo lo que se dibuja con volumen, de norte a sur. Las construcciones sin letra (por ejemplo AI)
// se dibujan igual que un edificio, pero no llevan etiqueta ni cuentan como zona.
export const VOLUMENES = [
  ...EDIFICIOS,
  ...campus.construcciones.map((c) => ({ ...c, alto: altoDe(c.niveles), sur: caja(c.puntos).y1 })),
].sort((a, b) => a.sur - b.sur)

// Un estacionamiento puede venir en varios polígonos (el 2): se rotula solo el más grande
export const ESTACIONAMIENTOS_ROTULADOS = Object.values(
  campus.estacionamientos.reduce((porId, e) => {
    if (!porId[e.id] || area(e.puntos) > area(porId[e.id].puntos)) porId[e.id] = e
    return porId
  }, {}),
)

const largoDe = (puntos) =>
  puntos.reduce(
    (s, p, i) => (i ? s + Math.hypot(p[0] - puntos[i - 1][0], p[1] - puntos[i - 1][1]) : 0),
    0,
  )

// El nombre de cada calle va sobre su tramo más largo, escrito de izquierda a derecha
export const CALLES_CON_NOMBRE = Object.values(
  campus.calles.reduce((porNombre, c) => {
    const largo = largoDe(c.puntos)
    if (!porNombre[c.nombre] || largo > porNombre[c.nombre].largo) {
      const puntos = c.puntos[0][0] > c.puntos.at(-1)[0] ? [...c.puntos].reverse() : c.puntos
      porNombre[c.nombre] = { nombre: c.nombre, puntos, largo }
    }
    return porNombre
  }, {}),
)

// Nombres de las unidades: posición elegida a mano (en metros) en un espacio libre
export const NOMBRES_UNIDADES = [
  { texto: 'Unidad Metal Mecánica', x: -138, y: -305 },
  { texto: 'Unidad Central', x: 125, y: -262 },
  { texto: 'Unidad Posgrado', x: 200, y: 250 },
]

/** Caja (en metros) de cada unidad, para los botones de salto rápido. */
export const CAJAS_UNIDADES = Object.fromEntries(campus.unidades.map((u) => [u.id, caja(u.puntos)]))
