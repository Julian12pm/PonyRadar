// Pantalla principal: barra superior con filtros, mapa del campus en medio y botones abajo.
// El mapa queda entre las dos barras para que nada lo tape ni corte edificios en la orilla.
//
// Fase 1: los pines viven solo en memoria (se pierden al recargar). En la Fase 2 vienen de Supabase.
import { useCallback, useMemo, useRef, useState } from 'react'
import Filtros from './componentes/Filtros.jsx'
import HojaLugar from './componentes/HojaLugar.jsx'
import Saltos from './componentes/Saltos.jsx'
import TarjetaPin from './componentes/TarjetaPin.jsx'
import Hoja from './componentes/Hoja.jsx'
import { filtrarPines } from './lib/filtros.js'
import MapaCampus from './mapa/MapaCampus.jsx'
import { detectarZona } from './mapa/deteccion.js'
import { PINES_DEMO, SEGUROS_DEMO } from './mapa/demo.js'

export default function App() {
  const mapa = useRef(null)
  const [pines, setPines] = useState(PINES_DEMO)
  const [filtro, setFiltro] = useState({ tipo: 'todos', categoria: null })
  const [fueraDeVista, setFueraDeVista] = useState({})
  // modo: null, o 'rojo'/'verde' cuando el usuario pulsó "Perdí algo"/"Encontré algo"
  const [modo, setModo] = useState(null)
  // Lo que está abierto en la hoja de abajo: un lugar tocado, un pin o un punto seguro
  const [lugar, setLugar] = useState(null)
  const [pinAbierto, setPinAbierto] = useState(null)
  const [seguroAbierto, setSeguroAbierto] = useState(null)
  const [grupoAbierto, setGrupoAbierto] = useState(null) // pines encimados en el mismo punto

  const visibles = useMemo(() => filtrarPines(pines, filtro), [pines, filtro])

  const cerrarTodo = useCallback(() => {
    setLugar(null)
    setPinAbierto(null)
    setSeguroAbierto(null)
    setGrupoAbierto(null)
  }, [])

  const tocarMapa = (punto) => {
    cerrarTodo()
    setLugar({ punto, zona: detectarZona(punto), tipo: modo })
  }

  const publicar = (datos) => {
    const nuevo = {
      id: `pin-${Date.now()}`,
      ...datos,
      punto: lugar.punto,
      zonaId: lugar.zona.id,
      creado: new Date().toISOString(),
    }
    setPines((anteriores) => [...anteriores, nuevo])
    setLugar(null)
    setModo(null)
  }

  const alternarModo = (tipo) => {
    cerrarTodo()
    setModo(modo === tipo ? null : tipo)
  }

  return (
    <main className="relative flex h-full flex-col bg-fondo">
      <header className="shrink-0 px-3 pt-3 pb-1">
        <div className="tarjeta mx-auto max-w-xl px-4 pt-2.5 pb-3">
          <h1 className="text-2xl leading-tight font-extrabold">PonyRadar</h1>
          <Filtros filtro={filtro} onCambiar={setFiltro} />
        </div>
      </header>

      <section className="relative min-h-0 flex-1" aria-label="Mapa del campus">
        <MapaCampus
          ref={mapa}
          pines={visibles}
          seguros={SEGUROS_DEMO}
          elegido={lugar?.punto ?? null}
          onTocarMapa={tocarMapa}
          onTocarPin={(pin) => {
            cerrarTodo()
            setPinAbierto(pin)
          }}
          onTocarGrupo={(lista) => {
            cerrarTodo()
            setGrupoAbierto(lista)
          }}
          onTocarSeguro={(seguro) => {
            cerrarTodo()
            setSeguroAbierto(seguro)
          }}
          onFueraDeVista={setFueraDeVista}
        />
      </section>

      <footer className="shrink-0 px-3 pt-2 pb-3">
        <div className="mx-auto max-w-md text-center">
          {modo ? (
            <p className="pista-uso" role="status">
              Toca el mapa donde lo {modo === 'rojo' ? 'perdiste' : 'encontraste'}
            </p>
          ) : (
            <Saltos contadores={fueraDeVista} onSaltar={(id) => mapa.current?.saltar(id)} />
          )}
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              className={`boton boton-rojo ${modo === 'rojo' ? 'boton-activo' : ''}`}
              aria-pressed={modo === 'rojo'}
              onClick={() => alternarModo('rojo')}
            >
              {modo === 'rojo' ? 'Cancelar' : 'Perdí algo'}
            </button>
            <button
              type="button"
              className={`boton boton-verde ${modo === 'verde' ? 'boton-activo' : ''}`}
              aria-pressed={modo === 'verde'}
              onClick={() => alternarModo('verde')}
            >
              {modo === 'verde' ? 'Cancelar' : 'Encontré algo'}
            </button>
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

      {lugar && (
        <HojaLugar
          key={`${lugar.punto}`}
          zona={lugar.zona}
          tipoInicial={lugar.tipo}
          onPublicar={publicar}
          onCerrar={cerrarTodo}
        />
      )}
      {pinAbierto && <TarjetaPin pin={pinAbierto} onCerrar={cerrarTodo} />}
      {grupoAbierto && (
        <Hoja titulo={`${grupoAbierto.length} pines aquí`} onCerrar={cerrarTodo}>
          <ul className="grid gap-1.5">
            {grupoAbierto.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="fila-pin"
                  onClick={() => {
                    cerrarTodo()
                    setPinAbierto(p)
                  }}
                >
                  <span
                    className={`punto-tipo ${p.tipo === 'rojo' ? 'bg-pin-rojo' : 'bg-pin-verde'}`}
                  />
                  {p.titulo}
                </button>
              </li>
            ))}
          </ul>
        </Hoja>
      )}
      {seguroAbierto && (
        <Hoja titulo={seguroAbierto.nombre} subtitulo="Punto seguro" onCerrar={cerrarTodo}>
          <p>{seguroAbierto.cantidad} objetos en resguardo.</p>
        </Hoja>
      )}
    </main>
  )
}
