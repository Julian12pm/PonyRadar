// Pantalla principal: barra superior, mapa del campus en medio y botones abajo.
// El mapa queda entre las dos barras para que nada lo tape ni corte edificios en la orilla.
import MapaCampus from './mapa/MapaCampus.jsx'
import { GRUPOS_DEMO, PINES_DEMO, SEGUROS_DEMO } from './mapa/demo.js'

const FILTROS = ['Todo', 'Perdidos', 'Encontrados', 'Categoría']

export default function App() {
  return (
    <main className="flex h-full flex-col bg-fondo">
      <header className="shrink-0 px-3 pt-3 pb-1">
        <div className="tarjeta mx-auto max-w-xl px-4 pt-2.5 pb-3">
          <h1 className="text-2xl leading-tight font-extrabold">PonyRadar</h1>
          <div className="chips mt-1.5 flex gap-1.5 overflow-x-auto">
            {FILTROS.map((f, i) => (
              <button key={f} className={`chip ${i === 0 ? 'chip-activo' : ''}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="relative min-h-0 flex-1" aria-label="Mapa del campus">
        <MapaCampus pines={PINES_DEMO} grupos={GRUPOS_DEMO} seguros={SEGUROS_DEMO} />
      </section>

      <footer className="shrink-0 px-3 pt-1 pb-3">
        <div className="mx-auto max-w-md text-center">
          <p className="pista-uso">Toca el mapa justo donde pasó</p>
          <div className="grid grid-cols-2 gap-2.5">
            <button className="boton boton-rojo">Perdí algo</button>
            <button className="boton boton-verde">Encontré algo</button>
          </div>
          <a
            className="atribucion"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap contributors
          </a>
        </div>
      </footer>
    </main>
  )
}
