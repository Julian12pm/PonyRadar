// Pantalla principal: el mapa del campus ocupa toda la pantalla y la interfaz flota encima.
import MapaCampus from './mapa/MapaCampus.jsx'
import { GRUPOS_DEMO, PINES_DEMO, SEGUROS_DEMO } from './mapa/demo.js'

// Espacio (en px) que tapan la barra superior y los botones de abajo; el mapa se encuadra entre ellos
const MARGENES = { arriba: 118, abajo: 150, lados: 10 }

const FILTROS = ['Todo', 'Perdidos', 'Encontrados', 'Categoría']

export default function App() {
  return (
    <main className="relative h-full overflow-hidden bg-[#e8ebdf]">
      <MapaCampus
        pines={PINES_DEMO}
        grupos={GRUPOS_DEMO}
        seguros={SEGUROS_DEMO}
        margenes={MARGENES}
      />

      <header className="pointer-events-none absolute inset-x-3 top-3">
        <div className="tarjeta pointer-events-auto px-4 pt-2.5 pb-3">
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

      <footer className="pointer-events-none absolute inset-x-3 bottom-3 text-center">
        <p className="pista-uso">Toca el mapa justo donde pasó</p>
        <div className="pointer-events-auto grid grid-cols-2 gap-2.5">
          <button className="boton boton-rojo">Perdí algo</button>
          <button className="boton boton-verde">Encontré algo</button>
        </div>
        <a
          className="atribucion pointer-events-auto"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </footer>
    </main>
  )
}
