// "Mis casos": avisos recientes y todos tus objetos (perdidos, encontrados y reclamados),
// agrupados por lo que te toca hacer.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import TarjetaCaso from '../componentes/TarjetaCaso.jsx'
import {
  accionPendiente,
  cargarCasos,
  cargarPuntosDisponibles,
  casoCerrado,
  misStrikes,
  textoAviso,
} from '../lib/casos.js'
import { veaPanelPunto } from '../lib/paneles.js'
import { mensajeStrikes } from '../lib/reglas.js'
import { haceCuanto } from '../lib/tiempo.js'

const GRUPOS = [
  { id: 'toca', titulo: 'Te toca' },
  { id: 'espera', titulo: 'En espera' },
  { id: 'cerrados', titulo: 'Cerrados' },
]
const grupoDe = (caso) =>
  accionPendiente(caso) ? 'toca' : casoCerrado(caso) ? 'cerrados' : 'espera'

export default function MisCasos({ perfil, avisos }) {
  const navegar = useNavigate()
  const [casos, setCasos] = useState(null)
  const [puntos, setPuntos] = useState([])
  const [strikes, setStrikes] = useState(0)
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)
  const yo = perfil?.id
  const { lista, noLeidos, version, marcarLeidos } = avisos

  // Se recarga al entrar, tras cada acción y con cada aviso nuevo en tiempo real
  useEffect(() => {
    if (!yo) return undefined
    let vigente = true
    // Los strikes y los puntos seguros son extra: si fallan, los casos se muestran igual
    Promise.all([
      cargarCasos(yo),
      cargarPuntosDisponibles().catch(() => []),
      misStrikes().catch(() => 0),
    ])
      .then(([c, p, n]) => {
        if (!vigente) return
        setCasos(c)
        setPuntos(p)
        setStrikes(n ?? 0)
        setError(null)
      })
      .catch((e) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [yo, recarga, version])

  // Los avisos que se muestran aquí cuentan como leídos (el contador del mapa se apaga)
  useEffect(() => {
    if (noLeidos > 0) marcarLeidos()
  }, [noLeidos, marcarLeidos])

  const recargar = useCallback(() => setRecarga((n) => n + 1), [])
  // Un objeto en resguardo no está en el mapa: se abre en la lista "En resguardo"
  // Un objeto en resguardo o un verde caducado no están en el mapa: se abren desde Listas
  const verPin = (id, estado) =>
    navegar(
      estado === 'en_resguardo'
        ? `/listas?vista=resguardo&pin=${id}`
        : estado === 'caducado'
          ? `/listas?pin=${id}`
          : `/?pin=${id}`,
    )
  const avisoStrikes = mensajeStrikes(strikes, perfil)
  // Los avisos de pines ajenos ("Lo encontré", coincidencia) abren el pin en el mapa;
  // los demás llevan a la tarjeta del caso en esta misma pantalla
  const abrirAviso = (aviso) => {
    if (!aviso.pinId) return
    if (['lo_encontraron', 'coincidencia'].includes(aviso.tipo)) verPin(aviso.pinId)
    else {
      const caso = document.getElementById(`caso-${aviso.pinId}`)
      // Un reclamo a un objeto en resguardo no es un caso propio: lo atiende el panel del punto
      if (caso) caso.scrollIntoView({ behavior: 'smooth' })
      else if (veaPanelPunto(perfil)) navegar('/punto')
    }
  }

  return (
    <main className="h-full overflow-y-auto bg-fondo">
      <header className="sticky top-0 z-10 bg-fondo px-3 pt-3 pb-2">
        <div className="tarjeta mx-auto flex max-w-xl items-center gap-2 px-4 pt-2.5 pb-2">
          <button type="button" className="chip" onClick={() => navegar('/')}>
            Mapa
          </button>
          <h1 className="flex-1 text-2xl leading-tight font-extrabold">Mis casos</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-xl gap-5 px-3 pb-8">
        {avisoStrikes && (
          <p role="status" className="aviso-cuenta">
            {avisoStrikes}
          </p>
        )}
        {lista.length > 0 && (
          <section aria-labelledby="titulo-avisos">
            <h2 id="titulo-avisos" className="titulo-grupo">
              Avisos {noLeidos > 0 && <span className="contador">{noLeidos}</span>}
            </h2>
            <ul className="grid gap-1.5">
              {lista.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={`aviso ${a.leido && !a.nuevo ? '' : 'aviso-nuevo'}`}
                    onClick={() => abrirAviso(a)}
                  >
                    <span className="flex-1">{textoAviso(a)}</span>
                    <span className="shrink-0 text-xs text-tinta/60">{haceCuanto(a.creado)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <p role="alert" className="tarjeta p-3 text-center font-semibold">
            No se pudieron cargar tus casos. {error}{' '}
            <button type="button" className="underline" onClick={recargar}>
              Reintentar
            </button>
          </p>
        )}
        {!casos && !error && <p className="text-center text-tinta/70">Cargando tus casos…</p>}
        {casos?.length === 0 && (
          <div className="tarjeta p-4 text-center">
            <p className="font-bold">Todavía no tienes casos.</p>
            <p className="text-sm">
              Cuando reportes algo o pulses “Es mío” en un pin, lo verás aquí.
            </p>
            <button
              type="button"
              className="boton boton-verde mt-3 w-full"
              onClick={() => navegar('/')}
            >
              Ir al mapa
            </button>
          </div>
        )}

        {casos?.length > 0 &&
          GRUPOS.map((g) => {
            const delGrupo = casos.filter((c) => grupoDe(c) === g.id)
            if (!delGrupo.length) return null
            return (
              <section key={g.id} aria-labelledby={`grupo-${g.id}`}>
                <h2 id={`grupo-${g.id}`} className="titulo-grupo">
                  {g.titulo}
                </h2>
                <div className="grid gap-3">
                  {delGrupo.map((c) => (
                    <div key={c.id} id={`caso-${c.pin.id}`}>
                      <TarjetaCaso caso={c} puntos={puntos} onCambio={recargar} onVerPin={verPin} />
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
      </div>
    </main>
  )
}
