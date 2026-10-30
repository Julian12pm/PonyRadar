// Revisa el aviso de versión nueva con el build real y su service worker:
//   1. Abre la app (build en `npm run preview`) y espera a que el service worker la controle.
//   2. Simula que se publica una versión nueva (cambia dist/sw.js).
//   3. Simula que el celular pierde y recupera la red (la app revisa al volver la red).
//   4. Debe aparecer "Hay una versión nueva"; "Actualizar" recarga una sola vez con el nuevo.
// Uso: npm run build && npx vite preview --port 4173   y en otra terminal:
//      node scripts/revision/version.mjs [http://localhost:4173]
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:4173'
const rutaSW = new URL('../../dist/sw.js', import.meta.url)
const original = readFileSync(rutaSW, 'utf8')
const r = {}
const nav = await chromium.launch()
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } })
  const p = await ctx.newPage()
  let cargas = 0
  p.on('load', () => cargas++)
  await p.goto(url)
  await p.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 20000 })
  const antes = await p.evaluate(
    async () => (await navigator.serviceWorker.getRegistration()).active.scriptURL,
  )
  r.sinAvisoAlInicio = (await p.getByText('Hay una versión nueva').count()) === 0

  // Se publica una versión nueva
  appendFileSync(rutaSW, `\n// version de prueba ${Date.now()}\n`)
  await ctx.setOffline(true)
  await ctx.setOffline(false)
  await p.getByText('Hay una versión nueva').waitFor({ timeout: 20000 })
  r.avisoAlVolverLaRed = true
  await p.screenshot({ path: '.playwright-mcp/aviso-version.png' })

  const cargasAntes = cargas
  // La recarga puede terminar antes de que regrese el clic: se espera desde antes
  const recarga = p.waitForEvent('load', { timeout: 20000 })
  await p.getByRole('button', { name: 'Actualizar' }).click()
  await recarga
  await p.waitForTimeout(1500)
  r.recargasAlActualizar = cargas - cargasAntes
  r.avisoDesaparece = (await p.getByText('Hay una versión nueva').count()) === 0
  r.controlaElNuevo = await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    return Boolean(navigator.serviceWorker.controller) && !reg.waiting
  })
  r.mismaUrlSW = antes.endsWith('/sw.js')
} finally {
  writeFileSync(rutaSW, original) // deja el build como estaba
  await nav.close()
}
console.log(JSON.stringify(r, null, 2))
const ok =
  r.sinAvisoAlInicio &&
  r.avisoAlVolverLaRed &&
  r.recargasAlActualizar === 1 &&
  r.avisoDesaparece &&
  r.controlaElNuevo
process.exit(ok ? 0 : 1)
