// Descarga los datos de OpenStreetMap del campus (y sus calles cercanas) desde la API oficial de OSM.
// Uso: node scripts/osm/descargar.mjs
// El archivo crudo se guarda en scripts/osm/campus.osm.json (no se sube al repositorio).
// Datos © OpenStreetMap contributors, licencia ODbL: https://www.openstreetmap.org/copyright

import { writeFile } from 'node:fs/promises'

// Rectángulo que cubre las 3 unidades del ITM: oeste, sur, este, norte
const BBOX = '-101.1900,19.7180,-101.1810,19.7255'
const URL_API = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${BBOX}`

const respuesta = await fetch(URL_API, {
  headers: { 'User-Agent': 'PonyRadar/0.1 (proyecto escolar, ITM)' },
})
if (!respuesta.ok) {
  throw new Error(`OSM respondió ${respuesta.status}: ${await respuesta.text()}`)
}

const destino = new URL('./campus.osm.json', import.meta.url)
await writeFile(destino, await respuesta.text())
console.log('Datos guardados en', destino.pathname)
