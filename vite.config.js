// Configuración de Vite y de Vitest (las pruebas usan esta misma configuración).
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// App instalable (PWA): manifiesto con los íconos de PonyRadar y un service worker que guarda
// la app (HTML, JS, CSS, íconos) para que abra rápido y sin red. Los datos de Supabase NO se
// guardan en el service worker: la copia local de pines la maneja la app (useDatosDelMapa).
// Al haber una versión nueva, la app muestra "Hay una versión nueva — Actualizar"
// (src/componentes/AvisoVersion.jsx), que activa el service worker nuevo y recarga una vez.
const pwa = VitePWA({
  registerType: 'prompt', // la versión nueva se activa con el botón "Actualizar"
  injectRegister: false, // lo registra AvisoVersion con virtual:pwa-register/react
  includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
  manifest: {
    name: 'PonyRadar',
    short_name: 'PonyRadar',
    description: 'Objetos perdidos y encontrados del Instituto Tecnológico de Morelia.',
    lang: 'es-MX',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#e9ebe1',
    theme_color: '#2b3a4a',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    // En la primera visita el service worker toma control al momento (la app ya abre sin red).
    // Una versión nueva NO se activa sola: espera a que la persona pulse "Actualizar".
    clientsClaim: true,
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    // Rutas de la app (/casos, /listas, /punto, /admin) abren index.html aunque no haya red
    navigateFallback: 'index.html',
  },
})

export default defineConfig({
  // En las pruebas no hace falta el service worker
  plugins: [react(), tailwindcss(), ...(process.env.VITEST ? [] : [pwa])],
  test: {
    // jsdom simula el navegador para poder probar componentes de React
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // El módulo virtual del plugin de PWA solo existe al compilar: en las pruebas se usa uno falso
    alias: { 'virtual:pwa-register/react': '/src/test/pwa-register-falso.js' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Solo medimos el código de la app, no las pruebas ni archivos de arranque
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**', 'src/main.jsx'],
    },
  },
})
