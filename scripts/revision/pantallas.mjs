// Revisión completa de pantallas con Playwright, con Supabase simulado (no toca la base real).
// Recorre todas las pantallas en celular (390×844) y escritorio (1440×900), guarda capturas y
// revisa en cada una: errores de JavaScript, desbordamiento horizontal, botones sin nombre e
// imágenes sin texto alternativo.
// Uso: npm run dev  y en otra terminal:  node scripts/revision/pantallas.mjs [url] [carpeta]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const URL_APP = process.argv[2] ?? 'http://localhost:5173'
const CARPETA = process.argv[3] ?? '.playwright-mcp/revision'
mkdirSync(CARPETA, { recursive: true })

const ahora = Date.now()
const iso = (h) => new Date(ahora + h * 3600e3).toISOString()
const P1 = 'aaaaaaaa-0000-0000-0000-000000000001'
let n = 0
const id = () => `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`
const fila = (autor, tipo, titulo, estado, cat, extra = {}) => ({
  id: id(),
  autor_id: autor,
  tipo,
  categoria: cat,
  titulo,
  descripcion: '',
  zona_id: 'edificio-K',
  piso: '',
  x: 40,
  y: -150,
  estado,
  creado_en: iso(-20),
  expira_en: iso(50),
  renovado: false,
  foto_publica: null,
  tiene_foto_nitida: false,
  punto_seguro_id: null,
  ...extra,
})

// Datos de ejemplo de una cuenta admin que también es personal de la Biblioteca
const yo = {
  id: 'yo',
  correo: 'l23121115+admin@morelia.tecnm.mx',
  nombre: 'l23121115+admin',
  rol: 'admin',
  bloqueado: false,
  suspendido_hasta: null,
}
const enMapa = [
  fila('otro', 'rojo', 'Calculadora Casio gris', 'activo', 'electronicos', { x: 30, y: -140 }),
  fila('otro', 'verde', 'Termo azul', 'activo', 'termos', {
    zona_id: 'jardin-unidad-central',
    x: 0,
    y: 50,
  }),
  fila('yo', 'verde', 'Sudadera gris', 'con_solicitud', 'ropa', { x: 60, y: -10 }),
]
const mios = [
  enMapa[2],
  fila('yo', 'rojo', 'Credencial del Tec', 'caducado', 'credenciales', { expira_en: iso(-30) }),
  fila('yo', 'verde', 'Audífonos blancos', 'en_camino', 'electronicos', { punto_seguro_id: P1 }),
]
const seBusca = [
  fila('otro', 'rojo', 'Mochila negra', 'caducado', 'mochilas', { expira_en: iso(-20) }),
]
const resguardo = [
  fila('otro', 'verde', 'Calculadora gris', 'en_resguardo', 'electronicos', {
    punto_seguro_id: P1,
    en_resguardo_desde: iso(-20),
  }),
  fila('otro', 'verde', 'Paraguas', 'en_camino', 'otros', {
    punto_seguro_id: P1,
    en_camino_desde: iso(-3),
  }),
]
const solicitud = (sid, pin, estado, respuesta, solicitante = 'otra') => ({
  id: sid,
  pin_id: pin,
  solicitante_id: solicitante,
  respuesta,
  estado,
  creado_en: iso(-1),
  resuelta_en: null,
  intentos_clave: 0,
  aceptada_en: estado === 'aceptada' ? iso(-1) : null,
  entregada_en: null,
  clave_generada_en: null,
})

async function simularSupabase(ctx, conSesion) {
  const sesion = {
    access_token: 'falso',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(ahora / 1000) + 3600,
    refresh_token: 'falso',
    user: { id: 'yo', email: yo.correo, aud: 'authenticated', role: 'authenticated' },
  }
  if (conSesion) {
    await ctx.addInitScript(
      (s) => localStorage.setItem('sb-hziwnqmetdodefwmugog-auth-token', JSON.stringify(s)),
      sesion,
    )
  }
  await ctx.route('**/rest/v1/**', (ruta) => {
    const url = decodeURIComponent(ruta.request().url())
    const json = (c) =>
      ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(c) })
    if (url.includes('/rpc/mis_strikes')) return json(1)
    if (url.includes('/rpc/admin_strikes_vigentes')) return json(1)
    if (url.includes('/rpc/puntos_disponibles'))
      return json([{ id: P1, nombre: 'Biblioteca (AF)', zona_id: 'edificio-AF' }])
    if (url.includes('/rpc/contacto_del_caso'))
      return json([{ nombre: 'l22120456', correo: 'l22120456@morelia.tecnm.mx', papel: 'dueno' }])
    if (url.includes('/rpc/')) return json(null)
    if (url.includes('/perfiles'))
      return json(
        url.includes('id=eq.yo')
          ? yo
          : [
              yo,
              { ...yo, id: 'c', correo: 'l22120999@morelia.tecnm.mx', rol: 'comunidad' },
              { ...yo, id: 's', correo: 'l23121064+sec@morelia.tecnm.mx', rol: 'comunidad' },
            ],
      )
    if (url.includes('/alias_permitidos'))
      return json([{ correo: yo.correo, nota: 'Cuenta admin', creado_en: iso(-100) }])
    if (url.includes('/moderacion'))
      return json([
        {
          id: 1,
          accion: 'eliminar_pin',
          titulo: 'asdf',
          tipo: 'rojo',
          motivo: 'Título basura',
          creado_en: iso(-5),
          autor: { correo: 'l23121064@morelia.tecnm.mx' },
        },
      ])
    if (url.includes('/strikes'))
      return json([
        {
          id: 'k1',
          creado_en: iso(-48),
          quitado_en: null,
          solicitud: { respuesta: 'Es rojo', pin: { titulo: 'Termo' } },
        },
      ])
    if (url.includes('/personal_punto_seguro')) {
      if (url.includes('perfil_id=eq.yo'))
        return json([{ punto: { id: P1, nombre: 'Biblioteca (AF)', zona_id: 'edificio-AF' } }])
      return json([{ punto_id: P1, perfil: { id: 'yo', correo: yo.correo, nombre: yo.nombre } }])
    }
    if (url.includes('/puntos_seguros'))
      return json([
        { id: P1, nombre: 'Biblioteca (AF)', zona_id: 'edificio-AF', activo: true },
        { id: 'p2', nombre: 'ISC', zona_id: 'edificio-K', activo: true },
      ])
    if (url.includes('/semestres'))
      return json([
        {
          id: 1,
          nombre: 'Agosto–Diciembre 2026',
          fecha_inicio: '2026-08-01',
          fecha_fin: '2026-12-31',
        },
      ])
    if (url.includes('/avisos'))
      return json([
        {
          id: 'v1',
          tipo: 'reclamaron_mi_objeto',
          pin_id: mios[0].id,
          solicitud_id: 's1',
          leido: false,
          creado_en: iso(-1),
          pin: { titulo: 'Sudadera gris' },
          solicitud: { estado: 'pendiente' },
        },
      ])
    if (url.includes('/datos_ciegos'))
      return json(
        url.includes('pin_id=in')
          ? [{ pin_id: resguardo[0].id, dato: 'Nombre "Luis" grabado' }]
          : { dato: 'Bordado del Tec en la manga' },
      )
    if (url.includes('/solicitudes')) {
      if (url.includes('solicitante_id=eq.yo')) return json(null)
      if (url.includes('pin_id=in'))
        return json([solicitud('s9', resguardo[0].id, 'pendiente', 'Tiene "Luis" grabado')])
      return json([solicitud('s1', mios[0].id, 'pendiente', 'Tiene el logo del Tec bordado')])
    }
    if (url.includes('/pines')) {
      if (url.includes('select=punto_seguro_id')) return json([{ punto_seguro_id: P1 }])
      if (url.includes('autor_id=eq.yo')) return json(mios)
      if (url.includes('pin_vinculado_id=in')) return json([])
      if (url.includes('tipo=eq.rojo')) return json(seBusca)
      if (url.includes('estado=eq.en_resguardo')) return json([resguardo[0]])
      if (url.includes('estado=eq.en_camino')) return json([resguardo[1]])
      if (url.includes('punto_seguro_id=in')) return json(resguardo)
      return json(enMapa)
    }
    return json([])
  })
  await ctx.route('**/auth/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sesion.user) }),
  )
  await ctx.route('**/storage/v1/**', (r) => r.fulfill({ status: 404, body: '' }))
  await ctx.route('**/realtime/**', (r) => r.abort())
}

/** Revisiones automáticas de la pantalla actual. */
async function revisar(p) {
  return p.evaluate(() => {
    const visibles = (sel) =>
      [...document.querySelectorAll(sel)].filter(
        (e) => e.offsetParent !== null || e.getClientRects().length,
      )
    const sinNombre = visibles('button, a[href], [role="button"]').filter((b) => {
      const nombre = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim()
      return !nombre && !b.getAttribute('aria-labelledby') && !b.title
    })
    return {
      desborde: document.documentElement.scrollWidth - window.innerWidth,
      botonesSinNombre: sinNombre.map((b) => b.outerHTML.slice(0, 80)),
      imagenesSinAlt: visibles('img')
        .filter((i) => !i.hasAttribute('alt'))
        .map((i) => i.src.slice(-40)),
    }
  })
}

const PANTALLAS = [
  {
    nombre: 'login',
    ruta: '/',
    sesion: false,
    listo: (p) => p.getByLabel('Correo institucional').waitFor(),
  },
  {
    nombre: 'mapa',
    ruta: '/',
    listo: (p) => p.getByRole('button', { name: 'Encontré algo' }).waitFor(),
  },
  {
    nombre: 'mapa-hoja-pin',
    ruta: '/',
    listo: async (p) => {
      await p
        .getByRole('button', { name: /Termo azul/ })
        .first()
        .click()
      await p.getByRole('dialog').waitFor()
    },
  },
  {
    nombre: 'mapa-publicar',
    ruta: '/',
    listo: async (p) => {
      await p.getByRole('button', { name: 'Perdí algo' }).click()
      const caja = await p.locator('.mapa-envoltura').boundingBox()
      await p.mouse.click(caja.x + caja.width * 0.62, caja.y + caja.height * 0.5)
      await p.getByRole('dialog').waitFor()
    },
  },
  {
    nombre: 'mis-casos',
    ruta: '/casos',
    listo: (p) => p.getByRole('heading', { name: 'Te toca' }).waitFor(),
  },
  {
    nombre: 'listas-se-busca',
    ruta: '/listas',
    listo: (p) => p.getByRole('button', { name: /Mochila negra/ }).waitFor(),
  },
  {
    nombre: 'listas-resguardo',
    ruta: '/listas?vista=resguardo',
    listo: (p) => p.getByRole('button', { name: /Calculadora gris/ }).waitFor(),
  },
  {
    nombre: 'panel-punto',
    ruta: '/punto',
    listo: (p) => p.getByRole('button', { name: 'Ya lo recibí' }).waitFor(),
  },
  {
    nombre: 'admin-usuarios',
    ruta: '/admin',
    listo: (p) => p.getByRole('button', { name: /l22120999/ }).waitFor(),
  },
  {
    nombre: 'admin-pines',
    ruta: '/admin?vista=pines',
    listo: (p) => p.getByRole('heading', { name: 'Eliminados recientemente' }).waitFor(),
  },
  {
    nombre: 'admin-puntos',
    ruta: '/admin?vista=puntos',
    listo: (p) => p.getByRole('heading', { name: 'ISC' }).waitFor(),
  },
  {
    nombre: 'admin-semestres',
    ruta: '/admin?vista=semestres',
    listo: (p) => p.getByText('Agosto–Diciembre 2026').waitFor(),
  },
  {
    nombre: 'admin-en-camino',
    ruta: '/admin?vista=camino',
    listo: (p) => p.getByText('Paraguas').waitFor(),
  },
]

const nav = await chromium.launch()
const problemas = []
for (const [dispositivo, ancho, alto] of [
  ['celular', 390, 844],
  ['escritorio', 1440, 900],
]) {
  for (const pantalla of PANTALLAS) {
    const ctx = await nav.newContext({
      viewport: { width: ancho, height: alto },
      deviceScaleFactor: 1,
    })
    await simularSupabase(ctx, pantalla.sesion !== false)
    const p = await ctx.newPage()
    const errores = []
    p.on('pageerror', (e) => errores.push(e.message))
    try {
      await p.goto(URL_APP + pantalla.ruta)
      await pantalla.listo(p)
      await p.waitForTimeout(400)
      const r = await revisar(p)
      await p.screenshot({
        path: `${CARPETA}/${dispositivo}-${pantalla.nombre}.png`,
        fullPage: true,
      })
      const mal = [
        ...errores.map((e) => `error JS: ${e}`),
        ...(r.desborde > 0 ? [`desborde horizontal de ${r.desborde}px`] : []),
        ...r.botonesSinNombre.map((b) => `botón sin nombre: ${b}`),
        ...r.imagenesSinAlt.map((i) => `imagen sin alt: ${i}`),
      ]
      console.log(mal.length ? '✗' : '✓', dispositivo, pantalla.nombre, mal.join(' | '))
      if (mal.length) problemas.push(`${dispositivo}/${pantalla.nombre}`)
    } catch (e) {
      console.log('✗', dispositivo, pantalla.nombre, e.message.split('\n')[0])
      problemas.push(`${dispositivo}/${pantalla.nombre}`)
      await p.screenshot({
        path: `${CARPETA}/${dispositivo}-${pantalla.nombre}-fallo.png`,
        fullPage: true,
      })
    }
    await ctx.close()
  }
}
await nav.close()
console.log(
  problemas.length
    ? `\n${problemas.length} pantallas con problemas`
    : '\nTodas las pantallas pasan',
)
process.exit(problemas.length ? 1 : 0)
