// Un caso en "Mis casos": el objeto, en qué va y lo que te toca hacer.
//   · Encontré (pin verde mío): revisar solicitudes y, tras aceptar, escribir la clave del dueño.
//   · Reclamé (mi solicitud): tras ser aceptado, ver la clave y la foto nítida.
//   · Perdí (pin rojo mío): ver los pines que alguien creó con "Lo encontré" y renovarlo.
//   · Fase 4: dejar el objeto en un punto seguro y renovar un pin rojo vencido.
import { useEffect, useState } from 'react'
import { nombreCategoria } from '../lib/categorias.js'
import {
  MAXIMO_INTENTOS,
  accionPendiente,
  dejarEnPuntoSeguro,
  generarClave,
  renovarPin,
  resumenCaso,
  responderSolicitud,
  solicitudEnEntrega,
  verificarClave,
} from '../lib/casos.js'
import { enlaceFoto, leerDatoCiego } from '../lib/pines.js'
import { haceCuanto } from '../lib/tiempo.js'
import { useAccion } from '../lib/useAccion.js'
import Contacto from './Contacto.jsx'

/** Quien encontró compara la respuesta del reclamante con su dato ciego y decide. */
export function RevisarSolicitud({
  solicitud,
  datoCiego,
  etiquetaDato = 'Tu dato ciego',
  onCambio,
}) {
  const [confirmarImpostor, setConfirmarImpostor] = useState(false)
  const { ocupado, error, correr } = useAccion(onCambio)
  const decidir = (decision) => correr(() => responderSolicitud(solicitud.id, decision))

  return (
    <li className="solicitud">
      <p className="text-sm text-tinta/70">Dice que es suyo porque:</p>
      <p className="text-lg leading-snug font-bold">“{solicitud.respuesta}”</p>
      {datoCiego && (
        <p className="mt-1 text-sm">
          {etiquetaDato}: <strong>{datoCiego}</strong>
        </p>
      )}
      {confirmarImpostor ? (
        <div className="mt-2.5 rounded-xl bg-[#fde7e8] p-2.5">
          <p className="text-sm font-semibold">
            Esto le suma un strike. Úsalo solo si claramente no es el dueño.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="boton-chico"
              onClick={() => setConfirmarImpostor(false)}
            >
              Volver
            </button>
            <button
              type="button"
              className="boton-chico bg-pin-rojo text-white"
              disabled={ocupado}
              onClick={() => decidir('impostor')}
            >
              Sí, es impostor
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <button
            type="button"
            className="boton-chico bg-pin-verde text-white"
            disabled={ocupado}
            onClick={() => decidir('aceptar')}
          >
            Aceptar
          </button>
          <button
            type="button"
            className="boton-chico"
            disabled={ocupado}
            onClick={() => decidir('rechazar')}
          >
            Rechazar
          </button>
          <button
            type="button"
            className="boton-chico text-pin-rojo"
            disabled={ocupado}
            onClick={() => setConfirmarImpostor(true)}
          >
            Impostor
          </button>
        </div>
      )}
      {error && <p className="mt-1.5 text-sm text-pin-rojo">{error}</p>}
    </li>
  )
}

/** Quien tiene el objeto escribe la clave que el dueño le dicta en persona. */
export function EscribirClave({ solicitud, onCambio }) {
  const [clave, setClave] = useState('')
  const [resultado, setResultado] = useState(null)
  const { ocupado, error, correr } = useAccion()
  const restantes = resultado?.intentosRestantes ?? MAXIMO_INTENTOS - solicitud.intentos

  const enviar = async (e) => {
    e.preventDefault()
    const r = await correr(() => verificarClave(solicitud.id, clave))
    if (!r) return
    setResultado(r)
    setClave('')
    if (r.ok || r.intentosRestantes === 0) onCambio?.()
  }

  return (
    <form onSubmit={enviar} className="mt-3">
      <label className="campo">
        Clave que te dicta el dueño
        <input
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          value={clave}
          onChange={(e) => setClave(e.target.value.replace(/\D/g, ''))}
          className="entrada-clave"
        />
      </label>
      <p className="mt-1 text-sm text-tinta/70">
        {resultado && !resultado.ok
          ? `Clave incorrecta. Te quedan ${restantes} ${restantes === 1 ? 'intento' : 'intentos'}.`
          : `Pídela en persona al entregar el objeto. ${restantes} intentos.`}
      </p>
      <button
        type="submit"
        className="boton boton-verde mt-2 w-full"
        disabled={ocupado || clave.length !== 4}
      >
        Confirmar entrega
      </button>
      {error && <p className="mt-1.5 text-sm text-pin-rojo">{error}</p>}
    </form>
  )
}

/** El dueño pide su clave de 4 dígitos y la dicta al recibir su objeto. */
function VerClave({ solicitud }) {
  const [clave, setClave] = useState(null)
  const { ocupado, error, correr } = useAccion()
  const pedir = async () => {
    const nueva = await correr(() => generarClave(solicitud.id))
    if (nueva) setClave(nueva)
  }

  return (
    <div className="mt-3">
      {clave ? (
        <>
          <p className="text-sm font-semibold">Tu clave de entrega</p>
          <p className="clave" aria-label={`Clave ${clave.split('').join(' ')}`}>
            {clave.split('').map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </p>
          <p className="mt-1.5 text-sm text-tinta/70">
            Díctala solo cuando tengas tu objeto en la mano. No la mandes por mensaje.
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            className="boton boton-verde w-full"
            disabled={ocupado}
            onClick={pedir}
          >
            {solicitud.claveGenerada ? 'Pedir una clave nueva' : 'Ver mi clave de entrega'}
          </button>
          {solicitud.claveGenerada && (
            <p className="mt-1 text-sm text-tinta/70">
              Por seguridad la clave solo se muestra una vez. La nueva reemplaza a la anterior.
            </p>
          )}
        </>
      )}
      {error && <p className="mt-1.5 text-sm text-pin-rojo">{error}</p>}
    </div>
  )
}

/** Quien encontró elige un punto seguro y deja ahí el objeto (queda "en camino"). */
function LlevarAPunto({ pin, puntos, destacado, onCambio }) {
  const [abierto, setAbierto] = useState(destacado)
  const [punto, setPunto] = useState(puntos[0]?.id ?? '')
  const { ocupado, error, correr } = useAccion(onCambio)

  if (!abierto) {
    return (
      <button type="button" className="enlace-accion mt-2" onClick={() => setAbierto(true)}>
        Dejar en un punto seguro
      </button>
    )
  }
  return (
    <div className="mt-3 grid gap-2">
      <label className="campo">
        Punto seguro
        <select value={punto} onChange={(e) => setPunto(e.target.value)}>
          {puntos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-tinta/70">
        Cuando el personal confirme que lo recibió, ya no será tu responsabilidad. Si el dueño lo
        reclama, se lo entregan ahí.
      </p>
      <button
        type="button"
        className="boton boton-verde w-full"
        disabled={ocupado || !punto}
        onClick={() => correr(() => dejarEnPuntoSeguro(pin.id, punto))}
      >
        Lo llevo a este punto seguro
      </button>
      {error && <p className="text-sm text-pin-rojo">{error}</p>}
    </div>
  )
}

/** El dueño de un pin rojo vencido lo vuelve a poner en el mapa 72 h (una sola vez). */
function Renovar({ pin, onCambio }) {
  const { ocupado, error, correr } = useAccion(onCambio)
  return (
    <div className="mt-2.5">
      <button
        type="button"
        className="boton boton-rojo w-full"
        disabled={ocupado}
        onClick={() => correr(() => renovarPin(pin.id))}
      >
        Renovar 72 horas en el mapa
      </button>
      {error && <p className="mt-1.5 text-sm text-pin-rojo">{error}</p>}
    </div>
  )
}

export default function TarjetaCaso({ caso, puntos = [], onCambio, onVerPin }) {
  const { pin, papel } = caso
  const accion = accionPendiente(caso)
  // Solo cuando le toca a quien lo encontró: en un punto seguro las atiende su personal
  const enEntrega = accion === 'entregar' ? solicitudEnEntrega(caso) : null
  const pendientes =
    accion === 'responder' ? caso.solicitudes.filter((s) => s.estado === 'pendiente') : []
  const aceptadoComoDueno = papel === 'reclame' && accion === 'clave'
  // Puede llevarlo a un punto seguro si sigue con él y nadie lo está reclamando
  const puedeLlevar =
    papel === 'encontre' &&
    ['activo', 'caducado'].includes(pin.estado) &&
    !caso.solicitudes.some(
      (s) => s.estado === 'pendiente' || (s.estado === 'aceptada' && !s.entregada),
    ) &&
    puntos.length > 0
  const [privado, setPrivado] = useState({ dato: null, foto: null })

  // Dato ciego para comparar (quien encontró) o foto nítida (dueño aceptado)
  const necesitaDato = pendientes.length > 0
  const necesitaFoto = aceptadoComoDueno && pin.tieneFotoNitida
  useEffect(() => {
    let vigente = true
    if (necesitaDato)
      leerDatoCiego(pin.id).then((dato) => vigente && setPrivado((p) => ({ ...p, dato })))
    if (necesitaFoto) {
      enlaceFoto(`${pin.id}/nitida.webp`).then(
        (foto) => vigente && setPrivado((p) => ({ ...p, foto })),
      )
    }
    return () => {
      vigente = false
    }
  }, [pin.id, necesitaDato, necesitaFoto])

  const etiqueta = { encontre: 'Lo encontraste', perdi: 'Lo perdiste', reclame: 'Lo reclamaste' }[
    papel
  ]
  return (
    <article className={`caso ${pin.tipo === 'rojo' ? 'caso-rojo' : 'caso-verde'}`}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg leading-tight font-extrabold">{pin.titulo}</h3>
          <p className="text-sm text-tinta/70">
            {etiqueta}, {nombreCategoria(pin.categoria).toLowerCase()},{' '}
            {haceCuanto(caso.solicitud?.creada ?? pin.creado)}
          </p>
        </div>
      </header>
      <p className={`mt-1.5 font-semibold ${accion ? 'text-tinta' : 'text-tinta/70'}`}>
        {resumenCaso(caso)}
      </p>

      {pendientes.length > 0 && (
        <ul className="mt-2 grid gap-2">
          {pendientes.map((s) => (
            <RevisarSolicitud
              key={s.id}
              solicitud={s}
              datoCiego={privado.dato}
              onCambio={onCambio}
            />
          ))}
        </ul>
      )}

      {enEntrega && (
        <>
          <Contacto solicitudId={enEntrega.id} objeto={pin.titulo} />
          <EscribirClave solicitud={enEntrega} onCambio={onCambio} />
        </>
      )}

      {aceptadoComoDueno && (
        <>
          {privado.foto && (
            <img
              src={privado.foto}
              alt="Foto nítida del objeto"
              className="mt-3 max-h-56 w-full rounded-xl object-cover"
            />
          )}
          <Contacto solicitudId={caso.solicitud.id} objeto={pin.titulo} />
          <VerClave solicitud={caso.solicitud} />
        </>
      )}

      {puedeLlevar && (
        <LlevarAPunto
          pin={pin}
          puntos={puntos}
          destacado={accion === 'llevar'}
          onCambio={onCambio}
        />
      )}

      {accion === 'renovar' && <Renovar pin={pin} onCambio={onCambio} />}

      {accion === 'reclamar' &&
        caso.encontrados
          .filter((v) => ['activo', 'con_solicitud', 'en_resguardo'].includes(v.estado))
          .map((v) => (
            <button
              key={v.id}
              type="button"
              className="boton-chico mt-2 w-full"
              onClick={() => onVerPin(v.id, v.estado)}
            >
              Ver lo que encontraron
            </button>
          ))}
    </article>
  )
}
