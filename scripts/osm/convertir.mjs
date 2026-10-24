// Convierte los datos crudos de OpenStreetMap (campus.osm.json) en las capas que dibuja el croquis.
// Uso: node scripts/osm/convertir.mjs   →   genera src/mapa/campus-osm.json
//
// Proyección: cada coordenada (lat, lon) se pasa a metros respecto a un origen en el centro del campus.
// x crece hacia el este y y crece hacia el sur (como en SVG). En un área tan chica (< 1 km)
// esto coincide con la proyección Web Mercator de openstreetmap.org salvo por la escala.
//
// Solo se conserva lo que está dentro de las 3 unidades, más las calles perimetrales con nombre.
// Los nombres, números de estacionamiento y accesos se verificaron contra el plano oficial
// (referencia/ITM_Plano_General.pdf, página 1).
//
// Datos © OpenStreetMap contributors, licencia ODbL: https://www.openstreetmap.org/copyright

import { readFile, writeFile } from 'node:fs/promises'
import { LEYENDA } from '../../src/mapa/leyenda.js'

export const ORIGEN = { lat: 19.7215, lon: -101.1855 }
const METROS_POR_GRADO_LAT = 110574
const METROS_POR_GRADO_LON = 111320 * Math.cos((ORIGEN.lat * Math.PI) / 180)

// Margen (en metros) alrededor de las 3 unidades: deja ver las calles perimetrales y los nombres
const MARGEN = 40

// Ids de OSM que necesitan un nombre o número que OSM no trae
const UNIDADES = {
  463491084: { id: 'unidad-central', nombre: 'Unidad Central' },
  463491081: { id: 'unidad-metal-mecanica', nombre: 'Unidad Metal Mecánica' },
  1134684602: { id: 'unidad-posgrado', nombre: 'Unidad Posgrado en Eléctrica' },
}
// Números de estacionamiento según el plano oficial; los demás se nombran por el edificio más cercano
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
// Edificios que existen en OSM pero no en el plano oficial: se dibujan sin letra y no son zona
const SIN_LETRA = ['AI']
// Accesos del plano oficial, ubicados en la reja (barrier=gate) correspondiente de OSM
const ACCESOS = [
  { id: 'acceso-raza-maya', nombre: 'Acceso Raza Maya', nodo: 8548186453 },
  { id: 'acceso-metal-mecanica', nombre: 'Acceso Metal Mecánica', nodo: 8189412832 },
  { id: 'acceso-av-tecnologico', nombre: 'Acceso Av. Tecnológico', nodo: 8230011062 },
  { id: 'acceso-periferico', nombre: 'Acceso Periférico Revolución', nodo: 8230011072 },
  { id: 'acceso-posgrado', nombre: 'Accesos Posgrado', nodo: 8519705361 },
]
// Calles perimetrales que se dibujan (nombre en OSM → nombre corto en el croquis)
const CALLES = {
  'Raza Maya': { nombre: 'Raza Maya', clase: 'calle' },
  'Calle Ingeniero Heber Soto Fierro': { nombre: 'Heber Soto Fierro', clase: 'calle' },
  'Avenida Tecnológico': { nombre: 'Av. Tecnológico', clase: 'avenida' },
  'Carretera Morelia - Salamanca': { nombre: 'Av. Tecnológico', clase: 'avenida' },
  'Periférico Revolución': { nombre: 'Periférico Revolución', clase: 'avenida' },
  'Calle Primer Congreso Constituyente de 1824': { nombre: 'Primer Congreso', clase: 'calle' },
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

// ─── Unidades y límites del dibujo ───

const unidades = Object.entries(UNIDADES).map(([idOsm, datos]) => ({
  ...datos,
  puntos: puntosDe(vias.get(Number(idOsm))),
}))
const unidadDe = (punto) => unidades.find((u) => dentro(punto, u.puntos))?.id ?? null

const todos = unidades.flatMap((u) => u.puntos)
const x0 = Math.floor(Math.min(...todos.map((p) => p[0])) - MARGEN)
const y0 = Math.floor(Math.min(...todos.map((p) => p[1])) - MARGEN)
const x1 = Math.ceil(Math.max(...todos.map((p) => p[0])) + MARGEN)
const y1 = Math.ceil(Math.max(...todos.map((p) => p[1])) + MARGEN)
const LIMITES = { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 }
const enLimites = ([x, y], extra = 0) =>
  x >= x0 - extra && x <= x1 + extra && y >= y0 - extra && y <= y1 + extra

/** Corta una línea en los tramos que quedan dentro de los límites del dibujo. */
function tramosDentro(puntos) {
  const tramos = []
  let actual = []
  for (const p of puntos) {
    if (enLimites(p, 15)) actual.push(p)
    else {
      if (actual.length > 1) tramos.push(actual)
      actual = []
    }
  }
  if (actual.length > 1) tramos.push(actual)
  return tramos
}

// ─── Clasificación ───

const salida = {
  atribucion: '© OpenStreetMap contributors (ODbL)',
  origen: ORIGEN,
  limites: LIMITES,
  unidades,
  edificios: [],
  construcciones: [], // edificios sin letra (se dibujan, pero no son zona)
  techados: [],
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
const sinNumero = [] // estacionamientos que se nombran al final

const canchasPorDeporte = {}
for (const via of vias.values()) {
  const t = via.tags ?? {}
  const puntos = puntosDe(via)
  if (puntos.length < 2) continue
  const c = centro(puntos)
  const unidad = unidadDe(c)

  if (CALLES[t.name] && t.highway) {
    for (const tramo of tramosDentro(puntos))
      salida.calles.push({ ...CALLES[t.name], puntos: tramo })
    continue
  }
  if (!unidad || UNIDADES[via.id]) continue // todo lo demás debe estar dentro de una unidad
  // Áreas verdes largas (como el camellón del Periférico) pueden tener el centro dentro pero estar
  // afuera: para ellas se exige que la mayoría de sus vértices estén dentro de la unidad
  const esVerde = t.landuse === 'grass' || t.leisure === 'park' || t.leisure === 'garden'
  if (esVerde && puntos.filter((p) => unidadDe(p)).length < puntos.length * 0.8) continue

  if (t.building) {
    const clave = t.name?.toUpperCase()
    const niveles = Number(t['building:levels'] ?? 1)
    if (clave && LEYENDA[clave]) {
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
    } else if (SIN_LETRA.includes(clave)) {
      salida.construcciones.push({ niveles, puntos })
    } else {
      salida.techados.push(puntos) // techados y construcciones menores sin nombre
    }
  } else if (t.amenity === 'parking') {
    if (ESTACIONAMIENTOS[via.id])
      salida.estacionamientos.push({ ...ESTACIONAMIENTOS[via.id], puntos })
    else sinNumero.push(puntos)
  } else if (CAMPOS[via.id]) {
    salida.campos.push({ ...CAMPOS[via.id], puntos })
  } else if (via.id === ALBERCA) {
    salida.alberca = { id: 'alberca', nombre: 'Alberca', puntos }
  } else if (t.leisure === 'pitch') {
    const deporte = t.sport?.includes('basketball')
      ? 'basquet'
      : t.sport?.includes('volleyball')
        ? 'voleibol'
        : 'futbol'
    const nombre = {
      basquet: 'Cancha de básquet',
      voleibol: 'Cancha de voleibol',
      futbol: 'Cancha',
    }
    // Se numeran por deporte: cancha-basquet-1, cancha-basquet-2, cancha-voleibol-1…
    canchasPorDeporte[deporte] = (canchasPorDeporte[deporte] ?? 0) + 1
    const id = `cancha-${deporte}-${canchasPorDeporte[deporte]}`
    salida.canchas.push({ id, deporte, nombre: nombre[deporte], puntos })
  } else if (
    (t.landuse === 'grass' || t.leisure === 'park' || t.leisure === 'garden') &&
    via.nodes[0] === via.nodes.at(-1)
  ) {
    salida.pasto.push(puntos)
  } else if (t.natural === 'wood') {
    salida.bosque.push(puntos)
  } else if (['footway', 'path', 'pedestrian', 'steps'].includes(t.highway)) {
    salida.andadores.push({ tipo: t.highway === 'steps' ? 'escalera' : 'andador', puntos })
  } else if (t.highway === 'service') {
    salida.internas.push(puntos)
  }
}

// Estacionamientos sin número: "Estacionamiento junto a AG", etc.
for (const puntos of sinNumero) {
  const c = centro(puntos)
  const cercano = salida.edificios
    .filter((e) => e.clave !== 'Ponyplaza')
    .reduce(
      (mejor, e) => {
        const [ex, ey] = centro(e.puntos)
        const d = Math.hypot(ex - c[0], ey - c[1])
        return d < mejor.d ? { e, d } : mejor
      },
      { d: Infinity },
    ).e
  salida.estacionamientos.push({
    id: `estacionamiento-junto-${cercano.clave}`,
    nombre: `Estacionamiento junto a ${cercano.clave}`,
    puntos,
  })
}

// Pista de atletismo (multipolígono con anillo exterior e interior)
const pista = relaciones.find((r) => r.id === PISTA)
const anillo = (rol) => puntosDe(vias.get(pista.members.find((m) => m.role === rol).ref))
salida.pista = {
  id: 'pista',
  nombre: 'Pista de atletismo',
  exterior: anillo('outer'),
  interior: anillo('inner'),
}

for (const a of ACCESOS) {
  salida.accesos.push({ id: a.id, nombre: a.nombre, punto: proyectar(nodos.get(a.nodo)) })
}

// Lugares con ícono junto a la letra de su edificio
const lugar = (tipo, nombre, clave, lado = 'derecha') =>
  salida.lugares.push({ tipo, nombre, edificio: `edificio-${clave}`, lado })
lugar('escolares', 'Servicios Escolares', 'A', 'izquierda') // a la derecha de A está D
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
  ...salida.construcciones.map((e) => e.puntos),
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
  const [zx0, zx1, zy0, zy1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const intentos = Math.round((zx1 - zx0) * (zy1 - zy0) * densidad)
  for (let i = 0; i < intentos; i++) {
    const p = [zx0 + azar() * (zx1 - zx0), zy0 + azar() * (zy1 - zy0)]
    const radio = 1.8 + azar() * 1.8
    if (!dentro(p, zona)) continue
    if (ocupados.some((o) => dentro(p, o) || cercaDeLinea(p, [...o, o[0]], radio + 0.5))) continue
    if (salida.andadores.some((a) => cercaDeLinea(p, a.puntos, radio + 1.5))) continue
    if (salida.internas.some((a) => cercaDeLinea(p, a, radio + 3))) continue
    if (salida.arboles.some(([x, y, r]) => Math.hypot(x - p[0], y - p[1]) < r + radio)) continue
    salida.arboles.push([redondear(p[0]), redondear(p[1]), redondear(radio)])
  }
}

await writeFile(new URL('../../src/mapa/campus-osm.json', import.meta.url), JSON.stringify(salida))
const resumen = Object.entries(salida)
  .filter(([, v]) => Array.isArray(v))
  .map(([k, v]) => `${k}: ${v.length}`)
console.log('campus-osm.json generado →', resumen.join(', '))
console.log('límites:', JSON.stringify(LIMITES))
console.log('estacionamientos:', salida.estacionamientos.map((e) => e.nombre).join(' · '))
