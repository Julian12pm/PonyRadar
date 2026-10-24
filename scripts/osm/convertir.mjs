// Convierte los datos crudos de OpenStreetMap (campus.osm.json) en las capas que dibuja el croquis.
// Uso: node scripts/osm/convertir.mjs   →   genera src/mapa/campus-osm.json
//
// Proyección: cada coordenada (lat, lon) se pasa a metros respecto a un origen en el centro del campus.
// x crece hacia el este y y crece hacia el sur (como en SVG). En un área tan chica (< 1 km)
// esto coincide con la proyección Web Mercator de openstreetmap.org salvo por la escala.
//
// Datos © OpenStreetMap contributors, licencia ODbL: https://www.openstreetmap.org/copyright

import { readFile, writeFile } from 'node:fs/promises'
import { LEYENDA } from '../../src/mapa/leyenda.js'

export const ORIGEN = { lat: 19.7215, lon: -101.1855 }
const METROS_POR_GRADO_LAT = 110574
const METROS_POR_GRADO_LON = 111320 * Math.cos((ORIGEN.lat * Math.PI) / 180)

// Área que se dibuja (en metros): cubre las 3 unidades y las calles que las rodean
const LIMITES = { x: -300, y: -330, ancho: 630, alto: 600 }

// Ids de OSM que necesitan un nombre o número que OSM no trae
const UNIDADES = {
  463491084: { id: 'unidad-central', nombre: 'Unidad Central' },
  463491081: { id: 'unidad-metal-mecanica', nombre: 'Unidad Metal Mecánica' },
  1134684602: { id: 'unidad-posgrado', nombre: 'Unidad Posgrado en Eléctrica' },
}
// Números de estacionamiento según el plano oficial
const ESTACIONAMIENTOS = {
  185088055: { id: 'estacionamiento-1', nombre: 'Estacionamiento 1' },
  880466520: { id: 'estacionamiento-2', nombre: 'Estacionamiento 2' },
  880466521: { id: 'estacionamiento-2', nombre: 'Estacionamiento 2' },
  185035273: { id: 'estacionamiento-3', nombre: 'Estacionamiento 3' },
  884987365: { id: 'estacionamiento-4', nombre: 'Estacionamiento 4' },
  185088046: { id: 'estacionamiento-5', nombre: 'Estacionamiento 5' },
}
const CAMPOS = {
  183837509: { id: 'campo-pista', nombre: 'Campo de fútbol de la pista' },
  183837499: { id: 'campo-futbol-ah', nombre: 'Campo de fútbol (junto a AH)' },
  1474196206: { id: 'cancha-ptar', nombre: 'Cancha junto a la PTAR' },
}
const ALBERCA = 1134684623
const PISTA = 17980593 // relación multipolígono: anillo exterior e interior
// Accesos: se toma la reja (barrier=gate) de OSM y se le pone el nombre de la calle
const ACCESOS = [
  { id: 'acceso-raza-maya', nombre: 'Acceso Raza Maya', nodo: 8548186453 },
  { id: 'acceso-metal-mecanica', nombre: 'Acceso Metal Mecánica', nodo: 8189412832 },
  {
    id: 'acceso-metal-mecanica-sur',
    nombre: 'Acceso Metal Mecánica (Av. Tecnológico)',
    nodo: 8230011062,
  },
  { id: 'acceso-periferico', nombre: 'Acceso Periférico Revolución', nodo: 8230011072 },
  { id: 'acceso-heber-soto', nombre: 'Acceso Heber Soto Fierro', nodo: 8519705358 },
  { id: 'acceso-posgrado', nombre: 'Acceso Posgrado', nodo: 8519705361 },
]
// Calles perimetrales que llevan nombre en el croquis
const CALLES_CON_NOMBRE = {
  'Raza Maya': 'Raza Maya',
  'Calle Ingeniero Heber Soto Fierro': 'Heber Soto Fierro',
  'Avenida Tecnológico': 'Av. Tecnológico',
  'Carretera Morelia - Salamanca': 'Av. Tecnológico',
  'Periférico Revolución': 'Periférico Revolución',
  'Calle Primer Congreso Constituyente de 1824': 'Primer Congreso',
}

// ─── Utilidades ───

const redondear = (n) => Math.round(n * 10) / 10

/** Pasa un nodo de OSM (lat, lon) a metros [x, y]. */
export function proyectar({ lat, lon }) {
  return [
    redondear((lon - ORIGEN.lon) * METROS_POR_GRADO_LON),
    redondear(-(lat - ORIGEN.lat) * METROS_POR_GRADO_LAT),
  ]
}

/** Punto dentro de polígono (regla par-impar). */
function dentro([x, y], poligono) {
  let adentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i]
    const [xj, yj] = poligono[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro
  }
  return adentro
}

const centro = (puntos) =>
  puntos.reduce((s, p) => [s[0] + p[0] / puntos.length, s[1] + p[1] / puntos.length], [0, 0])

const enLimites = (puntos, margen = 60) =>
  puntos.some(
    ([x, y]) =>
      x > LIMITES.x - margen &&
      x < LIMITES.x + LIMITES.ancho + margen &&
      y > LIMITES.y - margen &&
      y < LIMITES.y + LIMITES.alto + margen,
  )

// ─── Lectura ───

const crudo = JSON.parse(await readFile(new URL('./campus.osm.json', import.meta.url), 'utf8'))
const nodos = new Map()
const vias = new Map()
const relaciones = []
for (const el of crudo.elements) {
  if (el.type === 'node') nodos.set(el.id, el)
  else if (el.type === 'way') vias.set(el.id, el)
  else relaciones.push(el)
}

/** Puntos proyectados de una vía; quita el último si repite el primero (polígono cerrado). */
function puntosDe(via) {
  const pts = via.nodes
    .map((id) => nodos.get(id))
    .filter(Boolean)
    .map(proyectar)
  const cerrado = via.nodes[0] === via.nodes.at(-1)
  return cerrado ? pts.slice(0, -1) : pts
}

// ─── Clasificación ───

const salida = {
  atribucion: '© OpenStreetMap contributors (ODbL)',
  origen: ORIGEN,
  limites: LIMITES,
  unidades: [],
  edificios: [],
  techados: [],
  vecinos: [],
  canchas: [],
  campos: [],
  alberca: null,
  pista: null,
  estacionamientos: [],
  pasto: [],
  bosque: [],
  andadores: [],
  internas: [],
  calles: [],
  accesos: [],
  lugares: [],
}

for (const [idOsm, datos] of Object.entries(UNIDADES)) {
  salida.unidades.push({ ...datos, puntos: puntosDe(vias.get(Number(idOsm))) })
}
const unidadDe = (punto) => salida.unidades.find((u) => dentro(punto, u.puntos))?.id ?? null

let canchaNum = 0
for (const via of vias.values()) {
  const t = via.tags ?? {}
  const puntos = puntosDe(via)
  if (puntos.length < 2 || !enLimites(puntos)) continue
  const c = centro(puntos)

  if (t.building) {
    const unidad = unidadDe(c)
    const clave = t.name?.toUpperCase()
    const niveles = Number(t['building:levels'] ?? 1)
    if (clave && LEYENDA[clave] && unidad) {
      salida.edificios.push({
        id: `edificio-${clave}`,
        clave,
        nombre: LEYENDA[clave],
        unidad,
        niveles,
        puntos,
      })
    } else if (t.name === 'Ponyplaza') {
      salida.edificios.push({
        id: 'edificio-Ponyplaza',
        clave: 'Ponyplaza',
        nombre: 'Ponyplaza (comida)',
        unidad,
        niveles,
        puntos,
      })
    } else if (clave && unidad) {
      // Edificio con letra que no está en la leyenda oficial (por ejemplo AI)
      salida.edificios.push({
        id: `edificio-${clave}`,
        clave,
        nombre: `Edificio ${clave}`,
        unidad,
        niveles,
        puntos,
        sinLeyenda: true,
      })
    } else if (t.building === 'roof' && unidad) {
      salida.techados.push(puntos)
    } else if (unidad) {
      salida.techados.push(puntos) // construcciones menores sin nombre dentro del campus
    } else {
      salida.vecinos.push(puntos)
    }
  } else if (UNIDADES[via.id]) {
    continue
  } else if (t.amenity === 'parking' && unidadDe(c)) {
    const datos = ESTACIONAMIENTOS[via.id] ?? {
      id: `estacionamiento-osm-${via.id}`,
      nombre: 'Estacionamiento',
    }
    salida.estacionamientos.push({ ...datos, puntos })
  } else if (CAMPOS[via.id]) {
    salida.campos.push({ ...CAMPOS[via.id], puntos })
  } else if (via.id === ALBERCA) {
    salida.alberca = { id: 'alberca', nombre: 'Alberca', puntos }
  } else if (t.leisure === 'pitch' && unidadDe(c)) {
    canchaNum++
    const deporte = t.sport?.includes('basketball')
      ? 'basquet'
      : t.sport?.includes('volleyball')
        ? 'voleibol'
        : 'futbol'
    const nombre =
      deporte === 'basquet'
        ? 'Cancha de básquet'
        : deporte === 'voleibol'
          ? 'Cancha de voleibol'
          : 'Cancha'
    salida.canchas.push({ id: `cancha-${canchaNum}`, deporte, nombre, puntos })
  } else if (
    (t.landuse === 'grass' || t.leisure === 'park' || t.leisure === 'garden') &&
    via.nodes[0] === via.nodes.at(-1)
  ) {
    salida.pasto.push(puntos)
  } else if (t.natural === 'wood') {
    salida.bosque.push(puntos)
  } else if (['footway', 'path', 'pedestrian', 'steps'].includes(t.highway) && unidadDe(c)) {
    salida.andadores.push({ tipo: t.highway === 'steps' ? 'escalera' : 'andador', puntos })
  } else if (t.highway === 'service' && unidadDe(c)) {
    salida.internas.push(puntos)
  } else if (
    t.highway &&
    !['footway', 'path', 'steps', 'service', 'pedestrian'].includes(t.highway)
  ) {
    const clase = ['trunk', 'primary', 'trunk_link', 'primary_link'].includes(t.highway)
      ? 'avenida'
      : 'calle'
    salida.calles.push({ nombre: CALLES_CON_NOMBRE[t.name] ?? null, clase, puntos })
  }
}

// Pista de atletismo (multipolígono con anillo exterior e interior)
const pista = relaciones.find((r) => r.id === PISTA)
if (pista) {
  const anillo = (rol) => puntosDe(vias.get(pista.members.find((m) => m.role === rol).ref))
  salida.pista = {
    id: 'pista',
    nombre: 'Pista de atletismo',
    exterior: anillo('outer'),
    interior: anillo('inner'),
  }
}

for (const a of ACCESOS)
  salida.accesos.push({ id: a.id, nombre: a.nombre, punto: proyectar(nodos.get(a.nodo)) })

// Lugares con ícono: comida, biblioteca, cafetería, comedor
const lugar = (tipo, nombre, clave) =>
  salida.lugares.push({ tipo, nombre, edificio: `edificio-${clave}` })
lugar('comida', 'Ponyplaza', 'Ponyplaza')
lugar('biblioteca', 'Biblioteca', 'AF')
lugar('cafeteria', 'Cafetería', 'R')
lugar('comedor', 'Comedor estudiantil', 'X')
lugar('comedor', 'Comedor para trabajadores', 'S2')

// ─── Árboles ───
// OSM no trae árboles individuales aquí, así que se reparten sobre el pasto con posiciones
// pseudoaleatorias fijas (siempre salen iguales), lejos de edificios, andadores y canchas.

function distanciaASegmento([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
const cercaDeLinea = (p, puntos, d) =>
  puntos.some((a, i) => i > 0 && distanciaASegmento(p, puntos[i - 1], a) < d)

let semilla = 12345
const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
const ocupados = [
  ...salida.edificios.map((e) => e.puntos),
  ...salida.techados,
  ...salida.canchas.map((c) => c.puntos),
  ...salida.campos.map((c) => c.puntos),
  ...salida.estacionamientos.map((e) => e.puntos),
  salida.alberca.puntos,
  salida.pista.exterior,
]
salida.arboles = []
for (const [zona, densidad] of [
  ...salida.pasto.map((p) => [p, 1 / 140]),
  ...salida.bosque.map((p) => [p, 1 / 45]),
]) {
  const xs = zona.map((p) => p[0])
  const ys = zona.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const intentos = Math.round((x1 - x0) * (y1 - y0) * densidad)
  for (let i = 0; i < intentos; i++) {
    const p = [x0 + azar() * (x1 - x0), y0 + azar() * (y1 - y0)]
    const radio = 1.8 + azar() * 1.8
    if (!dentro(p, zona)) continue
    if (ocupados.some((o) => dentro(p, o) || cercaDeLinea(p, [...o, o[0]], radio + 0.5))) continue
    if (salida.andadores.some((a) => cercaDeLinea(p, a.puntos, radio + 1.5))) continue
    if (salida.arboles.some(([x, y, r]) => Math.hypot(x - p[0], y - p[1]) < r + radio)) continue
    salida.arboles.push([redondear(p[0]), redondear(p[1]), redondear(radio)])
  }
}

await writeFile(new URL('../../src/mapa/campus-osm.json', import.meta.url), JSON.stringify(salida))
const resumen = Object.entries(salida)
  .filter(([, v]) => Array.isArray(v))
  .map(([k, v]) => `${k}: ${v.length}`)
console.log('campus-osm.json generado →', resumen.join(', '))
