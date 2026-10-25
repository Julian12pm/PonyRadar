// Panel del admin:
//   · Usuarios: buscar por correo, cambiar rol, revisar y quitar strikes, desbloquear.
//   · Puntos seguros: crear, activar/desactivar y asignar personal (también a uno mismo).
//   · Semestres: las fechas que usan los strikes y el "no reclamado".
//   · En camino: objetos que nunca llegaron al punto seguro → regresarlos al mapa.
// El servidor revisa que quien llama sea admin; este panel solo se muestra a admins.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  activarPuntoSeguro,
  asignarPersonal,
  buscarPerfiles,
  cambiarRol,
  cargarEnCamino,
  cargarPuntosAdmin,
  cargarSemestres,
  cargarStrikes,
  crearPuntoSeguro,
  crearSemestre,
  desbloquear,
  horasDesde,
  quitarPersonal,
  quitarStrike,
  regresarAActivo,
  strikesVigentes,
} from '../lib/paneles.js'
import { fechaCorta, motivoSuspension } from '../lib/reglas.js'
import { useAccion } from '../lib/useAccion.js'
import { ZONAS, nombreCorto } from '../mapa/zonas.js'

const VISTAS = [
  { id: 'usuarios', titulo: 'Usuarios' },
  { id: 'puntos', titulo: 'Puntos seguros' },
  { id: 'semestres', titulo: 'Semestres' },
  { id: 'camino', titulo: 'En camino' },
]
const ROLES = [
  { id: 'comunidad', nombre: 'Comunidad' },
  { id: 'punto_seguro', nombre: 'Punto seguro' },
  { id: 'admin', nombre: 'Admin' },
]
const nombreRol = (rol) => ROLES.find((r) => r.id === rol)?.nombre ?? rol
const EDIFICIOS = ZONAS.filter((z) => z.tipo === 'edificio').sort((a, b) =>
  nombreCorto(a).localeCompare(nombreCorto(b), 'es', { numeric: true }),
)

/** Carga datos con useEffect y expone "recargar" (se vuelve a pedir tras cada acción). */
function useCarga(cargar, dependencias) {
  const [estado, setEstado] = useState({ datos: null, error: null })
  const [vuelta, setVuelta] = useState(0)
  useEffect(() => {
    let vigente = true
    cargar()
      .then((datos) => vigente && setEstado({ datos, error: null }))
      .catch((e) => vigente && setEstado((s) => ({ ...s, error: e.message })))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vuelta, ...dependencias])
  const recargar = useCallback(() => setVuelta((n) => n + 1), [])
  return { ...estado, recargar }
}

function MensajeError({ texto }) {
  return texto ? <p className="mt-1.5 text-sm text-pin-rojo">{texto}</p> : null
}

// ─── Usuarios ───

function DetalleUsuario({ usuario, soyYo, onCambio }) {
  const [rol, setRol] = useState(usuario.rol)
  const strikes = useCarga(() => cargarStrikes(usuario.id), [usuario.id])
  const vigentes = useCarga(() => strikesVigentes(usuario.id), [usuario.id])
  const alTerminar = () => {
    strikes.recargar()
    vigentes.recargar()
    onCambio()
  }
  const { ocupado, error, correr } = useAccion(alTerminar)
  const restringida = usuario.bloqueado || motivoSuspension(usuario)

  return (
    <div className="mt-2.5 grid gap-3 border-t-2 border-tinta/10 pt-2.5">
      <div>
        <label className="campo">
          Rol
          <div className="flex gap-2">
            <select
              className="flex-1"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              disabled={soyYo}
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="boton-chico px-3"
              disabled={ocupado || rol === usuario.rol}
              onClick={() => correr(() => cambiarRol(usuario.id, rol))}
            >
              Guardar
            </button>
          </div>
        </label>
        {soyYo && (
          <p className="mt-1 text-sm text-tinta/70">
            No puedes quitarte el rol de admin a ti mismo.
          </p>
        )}
      </div>

      {restringida && (
        <div className="aviso-cuenta">
          <p>
            {usuario.bloqueado
              ? 'Cuenta bloqueada por strikes.'
              : `Suspendida hasta el ${fechaCorta(usuario.suspendido_hasta)}.`}
          </p>
          <button
            type="button"
            className="boton-chico mt-2 w-full"
            disabled={ocupado}
            onClick={() => correr(() => desbloquear(usuario.id))}
          >
            {usuario.bloqueado ? 'Desbloquear cuenta' : 'Levantar suspensión'}
          </button>
        </div>
      )}

      <div>
        <p className="font-bold">
          Strikes vigentes: {vigentes.datos ?? '…'}
          <span className="font-normal text-tinta/70"> (este semestre)</span>
        </p>
        {strikes.datos?.length === 0 && <p className="text-sm text-tinta/70">Sin strikes.</p>}
        <ul className="mt-1.5 grid gap-1.5">
          {strikes.datos?.map((s) => (
            <li key={s.id} className="solicitud flex items-start gap-2">
              <div className="min-w-0 flex-1 text-sm">
                <p className={s.quitado ? 'line-through opacity-60' : 'font-semibold'}>
                  Reclamó "{s.objeto}" diciendo: “{s.respuesta}”
                </p>
                <p className="text-tinta/70">
                  {fechaCorta(s.creado)}
                  {s.quitado && `, quitado el ${fechaCorta(s.quitado)}`}
                </p>
              </div>
              {!s.quitado && (
                <button
                  type="button"
                  className="boton-chico shrink-0 px-2.5 text-sm"
                  disabled={ocupado}
                  onClick={() => correr(() => quitarStrike(s.id))}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <MensajeError texto={error ?? strikes.error} />
    </div>
  )
}

function Usuarios({ perfil }) {
  const [texto, setTexto] = useState('')
  const [buscado, setBuscado] = useState('')
  const [abierto, setAbierto] = useState(null)
  const usuarios = useCarga(() => buscarPerfiles(buscado), [buscado])

  return (
    <section className="grid gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setBuscado(texto)
        }}
      >
        <label className="campo flex-1">
          <span className="sr-only">Buscar por correo</span>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por correo, ej. l2312"
          />
        </label>
        <button type="submit" className="boton-chico px-4">
          Buscar
        </button>
      </form>
      <MensajeError texto={usuarios.error} />
      {usuarios.datos?.length === 0 && (
        <p className="text-center text-tinta/70">Nadie con ese correo.</p>
      )}
      <ul className="grid gap-2">
        {usuarios.datos?.map((u) => (
          <li key={u.id} className="tarjeta px-3.5 pt-2.5 pb-2.5">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              aria-expanded={abierto === u.id}
              onClick={() => setAbierto(abierto === u.id ? null : u.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{u.correo}</span>
                <span className="block text-sm text-tinta/70">
                  {nombreRol(u.rol)}
                  {u.bloqueado ? ', bloqueada' : motivoSuspension(u) ? ', suspendida' : ''}
                  {u.id === perfil?.id && ', tú'}
                </span>
              </span>
              <span aria-hidden="true" className="text-xl">
                {abierto === u.id ? '−' : '+'}
              </span>
            </button>
            {abierto === u.id && (
              <DetalleUsuario
                usuario={u}
                soyYo={u.id === perfil?.id}
                onCambio={usuarios.recargar}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Puntos seguros ───

function PuntoSeguro({ punto, perfil, onCambio }) {
  const [correo, setCorreo] = useState('')
  const { ocupado, error, correr } = useAccion(onCambio)
  const soyPersonal = punto.personal.some((p) => p.id === perfil?.id)

  return (
    <li className={`caso ${punto.activo ? 'caso-verde' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg leading-tight font-extrabold">{punto.nombre}</h3>
          <p className="text-sm text-tinta/70">
            {nombreCorto(ZONAS.find((z) => z.id === punto.zona_id))}
            {!punto.activo && ', desactivado'}
          </p>
        </div>
        <button
          type="button"
          className="boton-chico shrink-0 px-2.5 text-sm"
          disabled={ocupado}
          onClick={() => correr(() => activarPuntoSeguro(punto.id, !punto.activo))}
        >
          {punto.activo ? 'Desactivar' : 'Activar'}
        </button>
      </div>

      <p className="mt-2 font-bold">Personal</p>
      {punto.personal.length === 0 && <p className="text-sm text-tinta/70">Nadie asignado.</p>}
      <ul className="mt-1 grid gap-1">
        {punto.personal.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {p.correo}
              {p.id === perfil?.id && ' (tú)'}
            </span>
            <button
              type="button"
              className="enlace-accion shrink-0"
              disabled={ocupado}
              onClick={() => correr(() => quitarPersonal(punto.id, p.id))}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          await correr(() => asignarPersonal(punto.id, correo))
          setCorreo('')
        }}
      >
        <label className="campo flex-1">
          <span className="sr-only">Correo de quien atenderá {punto.nombre}</span>
          <input
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="correo@morelia.tecnm.mx"
          />
        </label>
        <button type="submit" className="boton-chico px-3" disabled={ocupado}>
          Asignar
        </button>
      </form>
      {!soyPersonal && (
        <button
          type="button"
          className="enlace-accion mt-2"
          disabled={ocupado}
          onClick={() => correr(() => asignarPersonal(punto.id, perfil.correo))}
        >
          Asignarme a mí
        </button>
      )}
      <MensajeError texto={error} />
    </li>
  )
}

function PuntosSeguros({ perfil }) {
  const puntos = useCarga(cargarPuntosAdmin, [])
  const [nombre, setNombre] = useState('')
  const [zona, setZona] = useState(EDIFICIOS[0]?.id ?? '')
  const { ocupado, error, correr } = useAccion(puntos.recargar)

  return (
    <section className="grid gap-3">
      <MensajeError texto={puntos.error} />
      <ul className="grid gap-3">
        {puntos.datos?.map((p) => (
          <PuntoSeguro key={p.id} punto={p} perfil={perfil} onCambio={puntos.recargar} />
        ))}
      </ul>
      <form
        className="tarjeta grid gap-2 p-3.5"
        onSubmit={async (e) => {
          e.preventDefault()
          await correr(() => crearPuntoSeguro(nombre, zona))
          setNombre('')
        }}
      >
        <h3 className="text-lg font-extrabold">Nuevo punto seguro</h3>
        <label className="campo">
          Nombre
          <input
            required
            maxLength={60}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Servicios Escolares (A)"
          />
        </label>
        <label className="campo">
          Edificio
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            {EDIFICIOS.map((z) => (
              <option key={z.id} value={z.id}>
                {nombreCorto(z)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="boton boton-verde" disabled={ocupado}>
          Crear punto seguro
        </button>
        <MensajeError texto={error} />
      </form>
    </section>
  )
}

// ─── Semestres ───

function Semestres() {
  const semestres = useCarga(cargarSemestres, [])
  const [nuevo, setNuevo] = useState({ nombre: '', inicio: '', fin: '' })
  const { ocupado, error, correr } = useAccion(semestres.recargar)
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <section className="grid gap-3">
      <p className="px-1 text-sm text-tinta/75">
        Los strikes se reinician con cada semestre y lo que sigue en resguardo al terminar se puede
        marcar "no reclamado".
      </p>
      <MensajeError texto={semestres.error} />
      <ul className="grid gap-2">
        {semestres.datos?.map((s) => {
          const vigente = s.fecha_inicio <= hoy && hoy <= s.fecha_fin
          return (
            <li
              key={s.id}
              className={`tarjeta px-3.5 pt-2.5 pb-2 ${vigente ? 'border-pin-verde' : ''}`}
            >
              <p className="font-bold">
                {s.nombre}
                {vigente && <span className="etiqueta-tipo ml-2 bg-pin-verde">Vigente</span>}
              </p>
              <p className="text-sm text-tinta/70">
                Del {fechaCorta(`${s.fecha_inicio}T12:00:00`)} al{' '}
                {fechaCorta(`${s.fecha_fin}T12:00:00`)}
              </p>
            </li>
          )
        })}
      </ul>
      <form
        className="tarjeta grid gap-2 p-3.5"
        onSubmit={async (e) => {
          e.preventDefault()
          await correr(() => crearSemestre(nuevo))
          setNuevo({ nombre: '', inicio: '', fin: '' })
        }}
      >
        <h3 className="text-lg font-extrabold">Nuevo semestre</h3>
        <label className="campo">
          Nombre
          <input
            required
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            placeholder="Ej. Enero–Junio 2027"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="campo">
            Empieza
            <input
              type="date"
              required
              value={nuevo.inicio}
              onChange={(e) => setNuevo({ ...nuevo, inicio: e.target.value })}
            />
          </label>
          <label className="campo">
            Termina
            <input
              type="date"
              required
              min={nuevo.inicio || undefined}
              value={nuevo.fin}
              onChange={(e) => setNuevo({ ...nuevo, fin: e.target.value })}
            />
          </label>
        </div>
        <button type="submit" className="boton boton-verde" disabled={ocupado}>
          Crear semestre
        </button>
        <MensajeError texto={error} />
      </form>
    </section>
  )
}

// ─── En camino ───

function EnCamino() {
  const objetos = useCarga(cargarEnCamino, [])
  const { ocupado, error, correr } = useAccion(objetos.recargar)
  return (
    <section className="grid gap-3">
      <p className="px-1 text-sm text-tinta/75">
        Objetos que alguien dijo que llevaría a un punto seguro. Si pasan 24 h sin confirmarse, se
        le avisa; si nunca llegó, aquí lo regresas al mapa con 72 h nuevas.
      </p>
      <MensajeError texto={objetos.error ?? error} />
      {objetos.datos?.length === 0 && (
        <p className="tarjeta p-4 text-center font-semibold">No hay objetos en camino.</p>
      )}
      <ul className="grid gap-2">
        {objetos.datos?.map((o) => {
          const horas = horasDesde(o.enCaminoDesde)
          return (
            <li key={o.id} className="caso caso-verde">
              <p className="text-lg leading-tight font-extrabold">{o.titulo}</p>
              <p className={`text-sm ${horas >= 24 ? 'font-bold text-pin-rojo' : 'text-tinta/70'}`}>
                En camino desde hace {horas} h
              </p>
              <button
                type="button"
                className="boton-chico mt-2 w-full"
                disabled={ocupado}
                onClick={() => correr(() => regresarAActivo(o.id))}
              >
                Regresar al mapa
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function PanelAdmin({ perfil }) {
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const vista = VISTAS.some((v) => v.id === parametros.get('vista'))
    ? parametros.get('vista')
    : 'usuarios'

  if (perfil?.rol !== 'admin') {
    return (
      <main className="grid h-full place-items-center bg-fondo p-6">
        <div className="tarjeta max-w-sm p-5 text-center">
          <p className="font-bold">Esta pantalla es solo para el admin.</p>
          <button
            type="button"
            className="boton boton-verde mt-3 w-full"
            onClick={() => navegar('/')}
          >
            Ir al mapa
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-full overflow-y-auto bg-fondo">
      <header className="sticky top-0 z-10 bg-fondo px-3 pt-3 pb-2">
        <div className="tarjeta mx-auto max-w-xl px-4 pt-2.5 pb-3">
          <div className="flex items-center gap-2">
            <button type="button" className="chip" onClick={() => navegar('/')}>
              Mapa
            </button>
            <h1 className="flex-1 text-2xl leading-tight font-extrabold">Admin</h1>
            <button type="button" className="chip" onClick={() => navegar('/punto')}>
              Punto seguro
            </button>
          </div>
          <div className="pestanas pestanas-4 mt-2" role="tablist" aria-label="Secciones">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={vista === v.id}
                className={vista === v.id ? 'pestana pestana-activa' : 'pestana'}
                onClick={() => setParametros({ vista: v.id }, { replace: true })}
              >
                {v.titulo}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-3 pb-8" role="tabpanel">
        {vista === 'usuarios' && <Usuarios perfil={perfil} />}
        {vista === 'puntos' && <PuntosSeguros perfil={perfil} />}
        {vista === 'semestres' && <Semestres />}
        {vista === 'camino' && <EnCamino />}
      </div>
    </main>
  )
}
