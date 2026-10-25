// Genera los íconos PNG de la app instalable (PWA) a partir de scripts/iconos/icono.svg.
// Usa el Chromium de Playwright para dibujar el SVG, así no hace falta otra herramienta.
// Uso: npm run iconos   (requiere: npx playwright install chromium)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const aqui = (ruta) => fileURLToPath(new URL(ruta, import.meta.url))
const svg = readFileSync(aqui('./icono.svg'), 'utf8')
const publico = (nombre) => fileURLToPath(new URL(`../../public/${nombre}`, import.meta.url))

// "maskable": Android recorta el ícono en círculo u otras formas; el dibujo debe caber
// en el 80 % central, así que se reduce y se rellena el borde con el mismo fondo.
const enmascarable = svg
  .replace(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2b3a4a"/><g transform="translate(51.2 51.2) scale(.8)">',
  )
  .replace('</svg>', '</g></svg>')

const salidas = [
  { nombre: 'pwa-192x192.png', tam: 192, fuente: svg },
  { nombre: 'pwa-512x512.png', tam: 512, fuente: svg },
  { nombre: 'maskable-icon-512x512.png', tam: 512, fuente: enmascarable },
  { nombre: 'apple-touch-icon-180x180.png', tam: 180, fuente: enmascarable },
]

const nav = await chromium.launch()
const pagina = await nav.newPage()
for (const { nombre, tam, fuente } of salidas) {
  await pagina.setViewportSize({ width: tam, height: tam })
  await pagina.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${tam}px;height:${tam}px}</style>${fuente}`,
  )
  writeFileSync(publico(nombre), await pagina.screenshot({ omitBackground: false }))
  console.log('✓', nombre)
}
// El favicon es el mismo dibujo con esquinas redondeadas
writeFileSync(
  publico('favicon.svg'),
  svg.replace(
    '<rect width="512" height="512" fill="#2b3a4a"/>',
    '<rect width="512" height="512" rx="112" fill="#2b3a4a"/>',
  ),
)
console.log('✓ favicon.svg')
await nav.close()
