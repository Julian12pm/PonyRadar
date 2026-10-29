// Listas fuera del mapa:
//   · "Se busca": pines rojos que ya salieron del mapa (72 h) y siguen 30 días aquí.
//   · "En resguardo": objetos guardados en cada punto seguro, que su dueño puede reclamar.
// Al tocar uno se abre la misma hoja que en el mapa ("Lo encontré" / "Es mío").
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import TarjetaPin from '../componentes/TarjetaPin.jsx'
import { nombreCategoria } from '../lib/categorias.js'
import { cargarListas, cargarPin } from '../lib/casos.js'
import { diasEnSeBusca, motivoSuspension } from '../lib/reglas.js'
import { haceCuanto } from '../lib/tiempo.js'
import { nombreCorto, zonaPorId } from '../mapa/zonas.js'

const VISTAS = [
  { id: 'sebusca', titulo: 'Se busca' },
  { id: 'resguardo', titulo: 'En resguardo' },
]

function FilaObjeto({ pin, detalle, onAbrir }) {
  return (
    <li>
      <button
        type="button"
        className={`objeto-lista ${pin.tipo === 'rojo' ? 'caso-rojo' : 'caso-verde'}`}
        onClick={() => onAbrir(pin)}
      >
        <span className="block truncate text-lg leading-tight font-extrabold">{pin.titulo}</span>
        <span className="block text-sm text-tinta/70">
          {nombreCategoria(pin.categoria)}, {nombreCorto(zonaPorId(pin.zonaId))}
        </span>
        <span className="mt-0.5 block text-sm font-semibold">{detalle}</span>
      </button>
    </li>
  )
}

export default function Listas({ perfil }) {
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const vista = parametros.get('vista') === 'resguardo' ? 'resguardo' : 'sebusca'
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    cargarListas()
      .then((d) => {
        if (!vigente) return
        setDatos(d)
        setError(null)
      })
      .catch((e) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [recarga])

  // Objetos en resguardo agrupados por punto seguro
  const porPunto = useMemo(() => {
    if (!datos) return []
    return datos.puntos
      .map((p) => ({ ...p, objetos: datos.enResguardo.filter((o) => o.puntoSeguroId === p.id) }))
      .filter((p) => p.objetos.length)
  }, [datos])

  // "?pin=<id>" abre ese objeto (desde Mis casos o un aviso)
  const idAbierto = parametros.get('pin')
  const enLista =
    idAbierto && datos
      ? ([...datos.seBusca, ...datos.enResguardo].find((p) => p.id === idAbierto) ?? null)
      : null
  // Si no está en ninguna lista (por ejemplo, un verde caducado que su dueño va a reclamar),
  // se trae aparte
  const [suelto, setSuelto] = useState(null)
  const buscarSuelto = Boolean(idAbierto && datos && !enLista)
  useEffect(() => {
    if (!buscarSuelto) return undefined
    let vigente = true
    cargarPin(idAbierto)
      .then((p) => vigente && setSuelto(p))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [idAbierto, buscarSuelto])
  const abierto = enLista ?? (suelto?.id === idAbierto ? suelto : null)
  const cambiarParametros = (cambios) => {
    const siguiente = new URLSearchParams(parametros)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) siguiente.set(clave, valor)
      else siguiente.delete(clave)
    }
    setParametros(siguiente, { replace: true })
  }

  const motivo = motivoSuspension(perfil)
  const lista = vista === 'sebusca' ? datos?.seBusca : datos?.enResguardo

  return (
    <div className="relative flex h-full flex-col bg-fondo">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-fondo px-3 pt-3 pb-2">
          <div className="tarjeta mx-auto max-w-xl px-4 pt-2.5 pb-3">
            <div className="flex items-center gap-2">
              <button type="button" className="chip" onClick={() => navegar('/')}>
                Mapa
              </button>
              <h1 className="flex-1 text-2xl leading-tight font-extrabold">Listas</h1>
            </div>
            <div className="pestanas mt-2" role="tablist" aria-label="Listas">
              {VISTAS.map((v) => {
                const n = v.id === 'sebusca' ? datos?.seBusca.length : datos?.enResguardo.length
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={vista === v.id}
                    className={vista === v.id ? 'pestana pestana-activa' : 'pestana'}
                    onClick={() => cambiarParametros({ vista: v.id, pin: null })}
                  >
                    {v.titulo}
                    {n != null && <span className="pestana-numero">{n}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-xl gap-4 px-3 pb-8" role="tabpanel">
          <p className="px-1 text-sm text-tinta/75">
            {vista === 'sebusca'
              ? 'Objetos perdidos que ya salieron del mapa. Siguen aquí 30 días: si encontraste alguno, avísale a su dueño.'
              : 'Objetos guardados en los puntos seguros. Si uno es tuyo, pulsa "Es mío" y recógelo ahí con tu clave.'}
          </p>
          {error && (
            <p role="alert" className="tarjeta p-3 text-center font-semibold">
              No se pudieron cargar las listas. {error}{' '}
              <button type="button" className="underline" onClick={() => setRecarga((n) => n + 1)}>
                Reintentar
              </button>
            </p>
          )}
          {!datos && !error && <p className="text-center text-tinta/70">Cargando…</p>}
          {lista?.length === 0 && (
            <p className="tarjeta p-4 text-center font-semibold">
              {vista === 'sebusca'
                ? 'No hay objetos en "Se busca". Los perdidos recientes están en el mapa.'
                : 'Ningún punto seguro tiene objetos guardados ahora.'}
            </p>
          )}

          {vista === 'sebusca' && datos?.seBusca.length > 0 && (
            <ul className="grid gap-2.5">
              {datos.seBusca.map((p) => {
                const dias = diasEnSeBusca(p)
                return (
                  <FilaObjeto
                    key={p.id}
                    pin={p}
                    detalle={`Se perdió ${haceCuanto(p.creado)}. ${dias === 1 ? 'Queda 1 día' : `Quedan ${dias} días`} en la lista.${p.verdeEnCursoId ? ' Alguien dijo que lo encontró.' : ''}`}
                    onAbrir={(pin) => cambiarParametros({ pin: pin.id })}
                  />
                )
              })}
            </ul>
          )}

          {vista === 'resguardo' &&
            porPunto.map((punto) => (
              <section key={punto.id} aria-labelledby={`punto-${punto.id}`}>
                <h2 id={`punto-${punto.id}`} className="titulo-grupo">
                  {punto.nombre} <span className="contador bg-tinta">{punto.objetos.length}</span>
                </h2>
                <ul className="grid gap-2.5">
                  {punto.objetos.map((p) => (
                    <FilaObjeto
                      key={p.id}
                      pin={p}
                      detalle={`Se encontró ${haceCuanto(p.creado)}.`}
                      onAbrir={(pin) => cambiarParametros({ pin: pin.id })}
                    />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </main>

      {abierto && (
        <TarjetaPin
          key={abierto.id}
          pin={abierto}
          yo={perfil?.id}
          habilitado={!motivo}
          motivoSoloLectura={motivo}
          onVerCasos={() => navegar('/casos')}
          onCerrar={() => cambiarParametros({ pin: null })}
        />
      )}
    </div>
  )
}
