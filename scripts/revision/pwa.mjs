// Revisa que la app sea instalable: manifiesto, íconos, service worker y que abra sin red.
// Uso: npm run build && npx vite preview --port 4173   y en otra terminal:
//      node scripts/revision/pwa.mjs [http://localhost:4173]
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:4173'
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
const r = {}

await p.goto(url)
// Espera a que el service worker tome control de la página
await p.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 20000 })
r.serviceWorker = true

const manifiesto = await p.evaluate(async () => {
  const enlace = document.querySelector('link[rel="manifest"]')
  return enlace ? (await fetch(enlace.href)).json() : null
})
r.manifiesto = manifiesto && {
  nombre: manifiesto.name,
  display: manifiesto.display,
  iconos: manifiesto.icons.map((i) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ''}`),
}

// Chrome dice si le falta algo para poder instalarla
const cdp = await ctx.newCDPSession(p)
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
r.erroresDeInstalacion = installabilityErrors.map((e) => e.errorId)

// Sin red: la app (y sus rutas) deben abrir desde el service worker
await ctx.setOffline(true)
await p.goto(`${url}/casos`)
r.abreSinRed = (await p.locator('#root').innerHTML()).length > 0
await ctx.setOffline(false)

console.log(JSON.stringify(r, null, 2))
await nav.close()
process.exit(r.erroresDeInstalacion.length || !r.abreSinRed ? 1 : 0)
