// Panel del punto seguro: lo que atiende el personal asignado.
//   · Por recibir: objetos "en camino" → confirmar que llegaron (quien lo trajo queda deslindado).
//   · Reclamos: comparar lo que dice el dueño con el dato ciego → aceptar / rechazar / impostor.
//   · Entregas: el dueño dicta su clave en persona y el personal la escribe.
//   · En resguardo: lo guardado; al terminar el semestre se marca "no reclamado".
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Contacto from '../componentes/Contacto.jsx'
import { EscribirClave, RevisarSolicitud } from '../componentes/TarjetaCaso.jsx'
import { nombreCategoria } from '../lib/categorias.js'
import {
  cargarPanelPunto,
  confirmarRecepcion,
  finDeSemestre,
  horasDesde,
  marcarNoReclamado,
  puedeMarcarNoReclamado,
} from '../lib/paneles.js'
import { fechaCorta } from '../lib/reglas.js'
import { haceCuanto } from '../lib/tiempo.js'
import { useAccion } from '../lib/useAccion.js'
import { nombreCorto, zonaPorId } from '../mapa/zonas.js'

function Encabezado({ pin, detalle }) {
  return (
    <header>
      <h3 className="truncate text-lg leading-tight font-extrabold">{pin.titulo}</h3>
      <p className="text-sm text-tinta/70">
        {nombreCategoria(pin.categoria)}, se encontró en {nombreCorto(zonaPorId(pin.zonaId))}
      </p>
      {detalle && <p className="mt-1 font-semibold">{detalle}</p>}
    </header>
  )
}

function PorRecibir({ pin, onCambio }) {
  const { ocupado, error, correr } = useAccion(onCambio)
  const horas = horasDesde(pin.enCaminoDesde)
  return (
    <article className="caso caso-verde">
      <Encabezado
        pin={pin}
        detalle={
          horas >= 24
            ? `En camino desde hace ${horas} h`
            : `En camino ${haceCuanto(pin.enCaminoDesde)}`
        }
      />
      <button
        type="button"
        className="boton boton-verde mt-2.5 w-full"
        disabled={ocupado}
        onClick={() => correr(() => confirmarRecepcion(pin.id))}
      >
        Ya lo recibí
      </button>
      {error && <p className="mt-1.5 text-sm text-pin-rojo">{error}</p>}
    </article>
  )
}

function EnResguardo({ pin, dato, semestres, solicitudes, onCambio }) {
  const [verDato, setVerDato] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const { ocupado, error, correr } = useAccion(onCambio)
  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente')
  const entrega = solicitudes.find((s) => s.estado === 'aceptada')
  const fin = finDeSemestre(pin.enResguardoDesde, semestres)
  const puedeMarcar = !entrega && puedeMarcarNoReclamado(pin.enResguardoDesde, semestres)

  return (
    <article className="caso caso-verde">
      <Encabezado
        pin={pin}
        detalle={`Recibido ${haceCuanto(pin.enResguardoDesde ?? pin.creado)}`}
      />

      {pendientes.length > 0 && (
        <>
          <p className="mt-2 font-semibold">
            {pendientes.length === 1
              ? 'Alguien dice que es suyo'
              : `${pendientes.length} personas dicen que es suyo`}
          </p>
          <ul className="mt-1.5 grid gap-2">
            {pendientes.map((s) => (
              <RevisarSolicitud
                key={s.id}
                solicitud={s}
                datoCiego={dato}
                etiquetaDato="Dato ciego"
                onCambio={onCambio}
              />
            ))}
          </ul>
        </>
      )}

      {entrega && (
        <>
          <p className="mt-2 font-semibold">Solicitud aceptada: entrega cuando el dueño venga</p>
          <Contacto solicitudId={entrega.id} objeto={pin.titulo} />
          <EscribirClave solicitud={entrega} onCambio={onCambio} />
        </>
      )}

      {!pendientes.length && !entrega && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" className="enlace-accion" onClick={() => setVerDato((v) => !v)}>
            {verDato ? 'Ocultar dato ciego' : 'Ver dato ciego'}
          </button>
          {puedeMarcar ? (
            <button type="button" className="enlace-accion" onClick={() => setConfirmar(true)}>
              Marcar no reclamado
            </button>
          ) : (
            fin && (
              <span className="text-sm text-tinta/70">
                Se puede marcar no reclamado después del {fechaCorta(`${fin}T12:00:00`)}
              </span>
            )
          )}
        </div>
      )}
      {verDato && dato && (
        <p className="privado mt-2">
          Dato ciego: <strong>{dato}</strong>
        </p>
      )}
      {confirmar && (
        <div className="mt-2.5 rounded-xl bg-[#fde7e8] p-2.5">
          <p className="text-sm font-semibold">
            Sale de la lista "En resguardo" y ya nadie podrá reclamarlo en la app.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className="boton-chico" onClick={() => setConfirmar(false)}>
              Volver
            </button>
            <button
              type="button"
              className="boton-chico bg-pin-rojo text-white"
              disabled={ocupado}
              onClick={() => correr(() => marcarNoReclamado(pin.id))}
            >
              Sí, no reclamado
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1.5 text-sm text-pin-rojo">{error}</p>}
    </article>
  )
}

export default function PanelPunto({ perfil, avisos }) {
  const navegar = useNavigate()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)
  const yo = perfil?.id
  const version = avisos?.version ?? 0

  // Se recarga al entrar, tras cada acción y con cada aviso nuevo (llegan los reclamos)
  useEffect(() => {
    if (!yo) return undefined
    let vigente = true
    cargarPanelPunto(yo)
      .then((d) => {
        if (!vigente) return
        setDatos(d)
        setError(null)
      })
      .catch((e) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [yo, recarga, version])
  const recargar = useCallback(() => setRecarga((n) => n + 1), [])

  const porRecibir = datos?.objetos.filter((o) => o.estado === 'en_camino') ?? []
  const enResguardo = datos?.objetos.filter((o) => o.estado === 'en_resguardo') ?? []
  const solicitudesDe = (pin) => datos.solicitudes.filter((s) => s.pinId === pin.id)
  // Primero los que tienen reclamos o entregas
  const ordenados = [...enResguardo].sort(
    (a, b) => (solicitudesDe(b).length ? 1 : 0) - (solicitudesDe(a).length ? 1 : 0),
  )

  return (
    <main className="h-full overflow-y-auto bg-fondo">
      <header className="sticky top-0 z-10 bg-fondo px-3 pt-3 pb-2">
        <div className="tarjeta mx-auto flex max-w-xl items-center gap-2 px-4 pt-2.5 pb-2">
          <button type="button" className="chip" onClick={() => navegar('/')}>
            Mapa
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-tight font-extrabold">Punto seguro</h1>
            {datos?.puntos.length > 0 && (
              <p className="truncate text-sm text-tinta/70">
                {datos.puntos.map((p) => p.nombre).join(', ')}
              </p>
            )}
          </div>
          <button type="button" className="chip" onClick={recargar}>
            Actualizar
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-xl gap-5 px-3 pb-8">
        {error && (
          <p role="alert" className="tarjeta p-3 text-center font-semibold">
            No se pudo cargar el panel. {error}{' '}
            <button type="button" className="underline" onClick={recargar}>
              Reintentar
            </button>
          </p>
        )}
        {!datos && !error && <p className="text-center text-tinta/70">Cargando…</p>}

        {datos?.puntos.length === 0 && (
          <div className="tarjeta p-4 text-center">
            <p className="font-bold">No atiendes ningún punto seguro.</p>
            <p className="text-sm">
              {perfil?.rol === 'admin'
                ? 'Asígnate como personal desde el panel de admin, en "Puntos seguros".'
                : 'Pide al admin que te asigne a uno.'}
            </p>
            {perfil?.rol === 'admin' && (
              <button
                type="button"
                className="boton boton-verde mt-3 w-full"
                onClick={() => navegar('/admin?vista=puntos')}
              >
                Ir al panel de admin
              </button>
            )}
          </div>
        )}

        {datos?.puntos.length > 0 && (
          <>
            <section aria-labelledby="por-recibir">
              <h2 id="por-recibir" className="titulo-grupo">
                Por recibir{' '}
                {porRecibir.length > 0 && <span className="contador">{porRecibir.length}</span>}
              </h2>
              {porRecibir.length ? (
                <div className="grid gap-3">
                  {porRecibir.map((p) => (
                    <PorRecibir key={p.id} pin={p} onCambio={recargar} />
                  ))}
                </div>
              ) : (
                <p className="px-1 text-sm text-tinta/70">Nadie ha dicho que traerá un objeto.</p>
              )}
            </section>

            <section aria-labelledby="resguardo">
              <h2 id="resguardo" className="titulo-grupo">
                En resguardo <span className="contador bg-tinta">{enResguardo.length}</span>
              </h2>
              {ordenados.length ? (
                <div className="grid gap-3">
                  {ordenados.map((p) => (
                    <EnResguardo
                      key={p.id}
                      pin={p}
                      dato={datos.datos[p.id]}
                      semestres={datos.semestres}
                      solicitudes={solicitudesDe(p)}
                      onCambio={recargar}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-1 text-sm text-tinta/70">No hay objetos guardados.</p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
