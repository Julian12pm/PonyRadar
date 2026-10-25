// Pantalla principal: barra superior con filtros, mapa del campus en medio y botones abajo.
// El mapa queda entre las dos barras para que nada lo tape ni corte edificios en la orilla.
// Los pines vienen de Supabase y se actualizan en tiempo real. Si el servidor no responde,
// el mapa sigue mostrando los últimos pines guardados en modo solo lectura.
import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import Filtros from '../componentes/Filtros.jsx'
import Hoja from '../componentes/Hoja.jsx'
import HojaLugar from '../componentes/HojaLugar.jsx'
import Saltos from '../componentes/Saltos.jsx'
import TarjetaPin from '../componentes/TarjetaPin.jsx'
import { MENSAJE_SIN_CONEXION, esErrorDeRed } from '../lib/conexion.js'
import { filtrarPines } from '../lib/filtros.js'
import { crearPin } from '../lib/pines.js'
import { esAdmin, veaPanelPunto } from '../lib/paneles.js'
import { motivoSuspension } from '../lib/reglas.js'
import { cerrarSesion, puedePublicar } from '../lib/sesion.js'
import { useDatosDelMapa } from '../lib/useDatosDelMapa.js'
import MapaCampus from '../mapa/MapaCampus.jsx'
import { frenteDeEdificio } from '../mapa/campus.js'
import { detectarZona } from '../mapa/deteccion.js'

const SIN_AVISOS = { noLeidos: 0 }

export default function Mapa({ perfil, avisos = SIN_AVISOS }) {
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const mapa = useRef(null)
  const { pines, seguros: puntosSeguros, enLinea, reintentar, sinConexion } = useDatosDelMapa()
  const [filtro, setFiltro] = useState({ tipo: 'todos', categoria: null })
  const [fueraDeVista, setFueraDeVista] = useState({})
  // modo: null, o 'rojo'/'verde' cuando el usuario pulsó "Perdí algo"/"Encontré algo"
  const [modo, setModo] = useState(null)
  // Lo que está abierto en la hoja de abajo
  const [lugar, setLugar] = useState(null)
  const [pinTocado, setPinTocado] = useState(null)
  // "/?pin=<id>" (desde Mis casos o un aviso) abre ese pin al llegar al mapa
  const idEnlace = parametros.get('pin')
  const pinAbierto = pinTocado ?? (idEnlace ? (pines.find((p) => p.id === idEnlace) ?? null) : null)
  const setPinAbierto = (pin) => {
    setPinTocado(pin)
    if (idEnlace) setParametros({}, { replace: true })
  }
  const [seguroAbierto, setSeguroAbierto] = useState(null)
  const [grupoAbierto, setGrupoAbierto] = useState(null) // pines encimados en el mismo punto

  // Sin conexión no se puede publicar; la suspensión solo cuenta si se conoce el perfil
  const suspendido = Boolean(perfil) && !puedePublicar(perfil)
  const habilitado = enLinea && !suspendido
  const motivoSoloLectura = !enLinea
    ? 'Sin conexión con el servidor: por ahora solo puedes ver el mapa.'
    : (motivoSuspension(perfil) ??
      'Tu cuenta está suspendida: puedes ver el mapa, pero no publicar pines.')

  const seguros = useMemo(
    () =>
      puntosSeguros
        .map((s) => ({ ...s, punto: frenteDeEdificio(s.zonaId, 0, 7) }))
        .filter((s) => s.punto),
    [puntosSeguros],
  )

  const visibles = useMemo(() => filtrarPines(pines, filtro), [pines, filtro])

  const cerrarTodo = useCallback(() => {
    setLugar(null)
    setPinTocado(null)
    if (parametros.has('pin')) setParametros({}, { replace: true })
    setSeguroAbierto(null)
    setGrupoAbierto(null)
  }, [parametros, setParametros])

  const tocarMapa = (punto) => {
    cerrarTodo()
    setLugar({ punto, zona: detectarZona(punto), tipo: habilitado ? modo : null })
  }

  // Lanza error si falla: HojaLugar lo muestra y no se cierra
  const publicar = async (datos) => {
    try {
      await crearPin({ ...datos, punto: lugar.punto, zonaId: lugar.zona.id })
    } catch (error) {
      if (esErrorDeRed(error)) {
        sinConexion()
        throw new Error(
          'No hay conexión con el servidor: tu pin no se publicó. Intenta de nuevo cuando vuelva.',
          { cause: error },
        )
      }
      throw error
    }
    // El pin también llega por tiempo real; se recarga por si la conexión en vivo tarda
    reintentar()
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
            {/* En celular solo el ícono, para que quepan todos los botones (con el de Panel son 4) */}
            <h1 className="flex flex-1 items-center gap-2 text-2xl leading-tight font-extrabold">
              <img src="/favicon.svg" alt="PonyRadar" className="size-8 shrink-0 sm:hidden" />
              <span className="hidden sm:inline">PonyRadar</span>
            </h1>
            <span className="hidden max-w-[30%] truncate text-sm text-tinta/70 sm:inline">
              {perfil?.nombre}
            </span>
            <button type="button" className="chip" onClick={() => navegar('/listas')}>
              Listas
            </button>
            {veaPanelPunto(perfil) && (
              <button
                type="button"
                className="chip chip-panel"
                onClick={() => navegar(esAdmin(perfil) ? '/admin' : '/punto')}
              >
                Panel
              </button>
            )}
            <button type="button" className="chip relative" onClick={() => navegar('/casos')}>
              Mis casos
              {avisos.noLeidos > 0 && (
                <span className="salto-contador" aria-label={`${avisos.noLeidos} avisos nuevos`}>
                  {avisos.noLeidos}
                </span>
              )}
            </button>
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
        {!enLinea && (
          <div role="status" className="aviso-flotante">
            <p>{MENSAJE_SIN_CONEXION}</p>
            <p className="text-xs font-normal">Mostrando los últimos pines guardados.</p>
            <button type="button" className="mt-1 text-sm underline" onClick={reintentar}>
              Reintentar ahora
            </button>
          </div>
        )}
      </section>

      <footer className="shrink-0 px-3 pt-2 pb-3">
        <div className="mx-auto max-w-md text-center">
          {modo && habilitado ? (
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
              {motivoSoloLectura}
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
          motivoSoloLectura={motivoSoloLectura}
          onPublicar={publicar}
          onCerrar={cerrarTodo}
        />
      )}
      {pinAbierto && (
        <TarjetaPin
          key={pinAbierto.id}
          pin={pinAbierto}
          yo={perfil?.id}
          habilitado={habilitado}
          motivoSoloLectura={motivoSoloLectura}
          onVerCasos={() => navegar('/casos')}
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
          {seguroAbierto.cantidad > 0 && (
            <button
              type="button"
              className="boton-chico mt-3 w-full"
              onClick={() => navegar('/listas?vista=resguardo')}
            >
              Ver lo que hay en resguardo
            </button>
          )}
        </Hoja>
      )}
    </main>
  )
}
