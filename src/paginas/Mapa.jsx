// Pantalla principal: barra superior con filtros, mapa del campus en medio y botones abajo.
// El mapa queda entre las dos barras para que nada lo tape ni corte edificios en la orilla.
// Los pines vienen de Supabase y se actualizan en tiempo real.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Filtros from '../componentes/Filtros.jsx'
import Hoja from '../componentes/Hoja.jsx'
import HojaLugar from '../componentes/HojaLugar.jsx'
import Saltos from '../componentes/Saltos.jsx'
import TarjetaPin from '../componentes/TarjetaPin.jsx'
import { filtrarPines } from '../lib/filtros.js'
import {
  aplicarCambio,
  cargarPines,
  cargarPuntosSeguros,
  crearPin,
  escucharPines,
} from '../lib/pines.js'
import { cerrarSesion, puedePublicar } from '../lib/sesion.js'
import MapaCampus from '../mapa/MapaCampus.jsx'
import { frenteDeEdificio } from '../mapa/campus.js'
import { detectarZona } from '../mapa/deteccion.js'

export default function Mapa({ perfil }) {
  const mapa = useRef(null)
  const [pines, setPines] = useState([])
  const [seguros, setSeguros] = useState([])
  const [errorCarga, setErrorCarga] = useState('')
  const [filtro, setFiltro] = useState({ tipo: 'todos', categoria: null })
  const [fueraDeVista, setFueraDeVista] = useState({})
  // modo: null, o 'rojo'/'verde' cuando el usuario pulsó "Perdí algo"/"Encontré algo"
  const [modo, setModo] = useState(null)
  // Lo que está abierto en la hoja de abajo
  const [lugar, setLugar] = useState(null)
  const [pinAbierto, setPinAbierto] = useState(null)
  const [seguroAbierto, setSeguroAbierto] = useState(null)
  const [grupoAbierto, setGrupoAbierto] = useState(null) // pines encimados en el mismo punto

  const habilitado = puedePublicar(perfil)

  // Carga inicial y cambios en tiempo real
  useEffect(() => {
    let vigente = true
    cargarPines()
      .then((lista) => vigente && setPines(lista))
      .catch(() => vigente && setErrorCarga('No se pudieron cargar los pines. Revisa tu conexión.'))
    cargarPuntosSeguros()
      .then(
        (lista) =>
          vigente &&
          setSeguros(
            lista
              .map((s) => ({ ...s, punto: frenteDeEdificio(s.zonaId, 0, 7) }))
              .filter((s) => s.punto),
          ),
      )
      .catch(() => {})
    const dejarDeEscuchar = escucharPines((pin) =>
      setPines((anteriores) => aplicarCambio(anteriores, pin)),
    )
    return () => {
      vigente = false
      dejarDeEscuchar()
    }
  }, [])

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

  // Lanza error si falla: HojaLugar lo muestra y no se cierra
  const publicar = async (datos) => {
    await crearPin({ ...datos, punto: lugar.punto, zonaId: lugar.zona.id })
    // El pin también llega por tiempo real; se recarga por si la conexión en vivo tarda
    cargarPines()
      .then(setPines)
      .catch(() => {})
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
          <div className="flex items-center gap-2">
            <h1 className="flex-1 text-2xl leading-tight font-extrabold">PonyRadar</h1>
            <span className="max-w-[45%] truncate text-sm text-tinta/70">{perfil?.nombre}</span>
            <button type="button" className="chip" onClick={cerrarSesion}>
              Salir
            </button>
          </div>
          <Filtros filtro={filtro} onCambiar={setFiltro} />
        </div>
      </header>

      <section className="relative min-h-0 flex-1" aria-label="Mapa del campus">
        <MapaCampus
          ref={mapa}
          pines={visibles}
          seguros={seguros}
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
        {errorCarga && (
          <p role="alert" className="aviso-flotante">
            {errorCarga}
          </p>
        )}
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
          {habilitado ? (
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
          ) : (
            <p className="mt-2.5 rounded-2xl bg-white px-3 pt-2.5 pb-2 text-sm font-semibold">
              Tu cuenta está suspendida: puedes ver el mapa, pero no publicar pines.
            </p>
          )}
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
          puedePublicar={habilitado}
          onPublicar={publicar}
          onCerrar={cerrarTodo}
        />
      )}
      {pinAbierto && (
        <TarjetaPin
          pin={pinAbierto}
          esMio={pinAbierto.autorId === perfil?.id}
          onCerrar={cerrarTodo}
        />
      )}
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
          <p>
            {seguroAbierto.cantidad === 1
              ? '1 objeto en resguardo.'
              : `${seguroAbierto.cantidad} objetos en resguardo.`}
          </p>
        </Hoja>
      )}
    </main>
  )
}
