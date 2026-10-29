// Panel del admin:
//   · Usuarios: buscar por correo, cambiar rol, revisar y quitar strikes, desbloquear; las
//     cuentas con "+alias" se marcan y aquí se autorizan los alias permitidos.
//   · Pines: buscar y eliminar un pin con motivo (queda registro).
//   · Puntos seguros: crear, activar/desactivar y asignar personal (también a uno mismo).
//   · Semestres: las fechas que usan los strikes y el "no reclamado".
//   · En camino: objetos que nunca llegaron al punto seguro → regresarlos al mapa.
// El servidor revisa que quien llama sea admin; este panel solo se muestra a admins.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  activarPuntoSeguro,
  asignarPersonal,
  autorizarAlias,
  buscarPerfiles,
  buscarPines,
  cambiarRol,
  cargarAliasPermitidos,
  cargarEnCamino,
  cargarModeracion,
  cargarPuntosAdmin,
  cargarSemestres,
  cargarStrikes,
  crearPuntoSeguro,
  crearSemestre,
  desbloquear,
  eliminarPin,
  horasDesde,
  quitarAlias,
  quitarPersonal,
  quitarStrike,
  regresarAActivo,
  strikesVigentes,
} from '../lib/paneles.js'
import { nombreCategoria } from '../lib/categorias.js'
import { buzonDe, esCorreoInstitucional, tieneAlias } from '../lib/correo.js'
import { fechaCorta, motivoSuspension } from '../lib/reglas.js'
import { haceCuanto } from '../lib/tiempo.js'
import { useAccion } from '../lib/useAccion.js'
import { ZONAS, nombreCorto } from '../mapa/zonas.js'

const VISTAS = [
  { id: 'usuarios', titulo: 'Usuarios' },
  { id: 'pines', titulo: 'Pines' },
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

/** Marca de una cuenta con "+alias": autorizada o no (las no autorizadas son de antes de 0011). */
function MarcaAlias({ correo, autorizados }) {
  if (!tieneAlias(correo)) return null
  const autorizado = autorizados?.some((a) => a.correo === correo)
  return autorizado ? (
    <span className="etiqueta-alias">Alias autorizado</span>
  ) : (
    <span className="etiqueta-alias etiqueta-alias-mal">
      Alias sin autorizar, buzón {buzonDe(correo)}
    </span>
  )
}

function AliasAutorizados({ alias, onCambio }) {
  const [correo, setCorreo] = useState('')
  const [nota, setNota] = useState('')
  const { ocupado, error, correr } = useAccion(onCambio)
  const valido = esCorreoInstitucional(correo) && tieneAlias(correo)

  return (
    <section className="tarjeta grid gap-2 p-3.5" aria-labelledby="titulo-alias">
      <h3 id="titulo-alias" className="text-lg font-extrabold">
        Alias autorizados
      </h3>
      <p className="text-sm text-tinta/75">
        Solo se permite una cuenta por correo institucional. Los correos con "+" de esta lista (por
        ejemplo, cuentas de prueba) sí pueden registrarse.
      </p>
      <ul className="grid gap-1">
        {alias?.map((a) => (
          <li key={a.correo} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{a.correo}</span>
              {a.nota && <span className="block text-tinta/70">{a.nota}</span>}
            </span>
            <button
              type="button"
              className="enlace-accion shrink-0"
              disabled={ocupado}
              onClick={() => correr(() => quitarAlias(a.correo))}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          await correr(() => autorizarAlias(correo, nota))
          setCorreo('')
          setNota('')
        }}
      >
        <label className="campo">
          Correo con alias
          <input
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="l23121115+prueba@morelia.tecnm.mx"
          />
        </label>
        <label className="campo">
          Nota (opcional)
          <input
            maxLength={120}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Para qué es"
          />
        </label>
        <button type="submit" className="boton-chico" disabled={ocupado || !valido}>
          Autorizar alias
        </button>
      </form>
      <MensajeError texto={error} />
    </section>
  )
}

function Usuarios({ perfil }) {
  const [texto, setTexto] = useState('')
  const [buscado, setBuscado] = useState('')
  const [soloAlias, setSoloAlias] = useState(false)
  const [abierto, setAbierto] = useState(null)
  const usuarios = useCarga(() => buscarPerfiles(buscado, soloAlias), [buscado, soloAlias])
  const alias = useCarga(cargarAliasPermitidos, [])

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
      <label className="flex items-center gap-2 px-1 text-sm font-semibold">
        <input
          type="checkbox"
          className="size-4"
          checked={soloAlias}
          onChange={(e) => setSoloAlias(e.target.checked)}
        />
        Solo cuentas con "+" en el correo
      </label>
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
                <MarcaAlias correo={u.correo} autorizados={alias.datos} />
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
      <AliasAutorizados alias={alias.datos} onCambio={alias.recargar} />
    </section>
  )
}

// ─── Pines (moderación) ───

function PinModerado({ pin, onCambio }) {
  const [confirmar, setConfirmar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const { ocupado, error, correr } = useAccion(onCambio)

  return (
    <li className={`caso ${pin.tipo === 'rojo' ? 'caso-rojo' : 'caso-verde'}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-tight font-extrabold">{pin.titulo}</p>
          <p className="text-sm text-tinta/70">
            {pin.tipo === 'rojo' ? 'Perdido' : 'Encontrado'}, {nombreCategoria(pin.categoria)},{' '}
            {pin.estado.replace('_', ' ')}, {haceCuanto(pin.creado)}
          </p>
          <p className="text-sm">{pin.autorCorreo}</p>
        </div>
        {!confirmar && (
          <button
            type="button"
            className="boton-chico shrink-0 px-2.5 text-sm text-pin-rojo"
            onClick={() => setConfirmar(true)}
          >
            Eliminar
          </button>
        )}
      </div>
      {confirmar && (
        <form
          className="mt-2.5 grid gap-2 rounded-xl bg-[#fde7e8] p-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            correr(() => eliminarPin(pin.id, motivo))
          }}
        >
          <label className="campo">
            Motivo (queda registrado)
            <textarea
              rows={2}
              required
              maxLength={300}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Título sin sentido, pin de prueba"
            />
          </label>
          <p className="text-sm font-semibold">
            Se borra el pin con sus solicitudes y avisos. No se puede deshacer.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="boton-chico" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
            <button
              type="submit"
              className="boton-chico bg-pin-rojo text-white"
              disabled={ocupado || motivo.trim().length < 3}
            >
              Eliminar pin
            </button>
          </div>
        </form>
      )}
      <MensajeError texto={error} />
    </li>
  )
}

function Pines() {
  const [texto, setTexto] = useState('')
  const [buscado, setBuscado] = useState('')
  const pines = useCarga(() => buscarPines(buscado), [buscado])
  const historial = useCarga(cargarModeracion, [])
  const recargar = () => {
    pines.recargar()
    historial.recargar()
  }

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
          <span className="sr-only">Buscar por título</span>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por título"
          />
        </label>
        <button type="submit" className="boton-chico px-4">
          Buscar
        </button>
      </form>
      <MensajeError texto={pines.error} />
      {pines.datos?.length === 0 && <p className="text-center text-tinta/70">Ningún pin.</p>}
      <ul className="grid gap-2">
        {pines.datos?.map((p) => (
          <PinModerado key={p.id} pin={p} onCambio={recargar} />
        ))}
      </ul>
      {historial.datos?.length > 0 && (
        <section aria-labelledby="titulo-eliminados">
          <h3 id="titulo-eliminados" className="titulo-grupo">
            Eliminados recientemente
          </h3>
          <ul className="grid gap-1.5">
            {historial.datos.map((m) => (
              <li key={m.id} className="solicitud text-sm">
                <p className="font-semibold">
                  {m.titulo} ({m.tipo === 'rojo' ? 'perdido' : 'encontrado'}) de {m.autorCorreo}
                </p>
                <p className="text-tinta/70">
                  {fechaCorta(m.creado_en)}: {m.motivo}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
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

      {punto.activo && punto.personal.length === 0 && (
        <p role="status" className="aviso-cuenta mt-2 text-sm">
          Nadie atiende este punto: no aparece como opción para dejar objetos hasta que asignes a
          alguien.
        </p>
      )}
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
          <div className="pestanas pestanas-admin mt-2" role="tablist" aria-label="Secciones">
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
        {vista === 'pines' && <Pines />}
      </div>
    </main>
  )
}
