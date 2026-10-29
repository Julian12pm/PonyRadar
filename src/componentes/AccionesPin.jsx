// Acciones al abrir un pin ajeno:
//   · Pin verde: "Es mío" → escribes lo que solo el dueño sabría (se compara con el dato ciego).
//   · Pin rojo: "Lo encontré" → creas un pin verde vinculado con tu dato ciego y se avisa al dueño.
// En tu propio pin con solicitudes, lleva a "Mis casos".
// Un verde que alguien creó con "Lo encontré" solo lo reclama el dueño del pin rojo, y un rojo
// que ya encontraron no acepta otro "Lo encontré".
import { useEffect, useState } from 'react'
import { loEncontre, miSolicitudAlPin, solicitarPin, soyAutorDelPin } from '../lib/casos.js'
import { enSeBusca } from '../lib/reglas.js'

const largoValido = (texto) => texto.trim().length >= 3 && texto.trim().length <= 200

function FormularioEsMio({ pin, onListo, onCancelar }) {
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await solicitarPin(pin.id, respuesta)
      onListo()
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="mt-3 grid gap-2">
      <label className="campo">
        ¿Qué tiene que solo el dueño sabría?
        <textarea
          rows={3}
          maxLength={200}
          required
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          placeholder="Ej. una calcomanía de un gato atrás, la funda rota en una esquina"
        />
      </label>
      <p className="text-sm text-tinta/70">
        Quien lo encontró lo compara con lo que anotó. Si no coincide, puede marcarte como impostor.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-chico" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          type="submit"
          className="boton-chico bg-pin-verde text-white"
          disabled={enviando || !largoValido(respuesta)}
        >
          Enviar solicitud
        </button>
      </div>
      {error && <p className="text-sm text-pin-rojo">{error}</p>}
    </form>
  )
}

function FormularioLoEncontre({ pin, onListo, onCancelar }) {
  const [datoCiego, setDatoCiego] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await loEncontre(pin.id, { descripcion: descripcion.trim(), datoCiego: datoCiego.trim() })
      onListo()
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="mt-3 grid gap-2">
      <label className="campo">
        Dato ciego (solo tú lo ves)
        <input
          maxLength={200}
          required
          value={datoCiego}
          onChange={(e) => setDatoCiego(e.target.value)}
          placeholder="Algo que solo el dueño sabría"
        />
      </label>
      <label className="campo">
        Dónde está ahora (opcional)
        <input
          maxLength={200}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej. lo tengo yo, lo traigo en la tarde"
        />
      </label>
      <p className="text-sm text-tinta/70">
        Se crea un pin verde en el mismo lugar y se avisa al dueño para que lo reclame.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-chico" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          type="submit"
          className="boton-chico bg-pin-verde text-white"
          disabled={enviando || !largoValido(datoCiego)}
        >
          Avisar al dueño
        </button>
      </div>
      {error && <p className="text-sm text-pin-rojo">{error}</p>}
    </form>
  )
}

export default function AccionesPin({ pin, yo, habilitado, motivoSoloLectura, onVerCasos }) {
  const esMio = pin.autorId === yo
  const candidato =
    !esMio &&
    pin.tipo === 'verde' &&
    ['activo', 'con_solicitud', 'en_resguardo'].includes(pin.estado)
  const vinculado = Boolean(pin.pinVinculadoId)
  const [formulario, setFormulario] = useState(null) // 'es-mio' | 'lo-encontre'
  const [hecho, setHecho] = useState(null)
  // undefined mientras se revisa si ya enviaste solicitud a este pin
  const [miSolicitud, setMiSolicitud] = useState(candidato ? undefined : null)
  // Verde vinculado a un rojo: ¿el rojo es mío? (undefined mientras se revisa)
  const [duenoDelRojo, setDuenoDelRojo] = useState(vinculado ? undefined : true)

  useEffect(() => {
    if (!candidato) return undefined
    let vigente = true
    Promise.all([
      miSolicitudAlPin(pin.id, yo).catch(() => null),
      vinculado ? soyAutorDelPin(pin.pinVinculadoId, yo).catch(() => false) : true,
    ]).then(([solicitud, dueno]) => {
      if (!vigente) return
      setMiSolicitud(solicitud)
      setDuenoDelRojo(dueno)
    })
    return () => {
      vigente = false
    }
  }, [pin.id, pin.pinVinculadoId, yo, candidato, vinculado])
  const reclamable = candidato && duenoDelRojo === true

  const verCasos = (
    <button type="button" className="boton-chico mt-2 w-full" onClick={onVerCasos}>
      Ver en Mis casos
    </button>
  )

  if (hecho) {
    return (
      <div className="hecho mt-3" role="status">
        <p className="font-bold">{hecho}</p>
        {verCasos}
      </div>
    )
  }

  if (esMio) {
    return ['con_solicitud', 'aceptado'].includes(pin.estado) ? verCasos : null
  }

  if (pin.estado === 'aceptado') {
    return (
      <p className="mt-3 text-sm font-semibold text-tinta/70">Este objeto ya está en entrega.</p>
    )
  }

  if (candidato && (miSolicitud === undefined || duenoDelRojo === undefined)) return null
  if (candidato && !duenoDelRojo) {
    return (
      <p className="mt-3 text-sm font-semibold text-tinta/70">
        Lo encontraron para quien lo reportó como perdido: solo esa persona puede reclamarlo.
      </p>
    )
  }
  if (miSolicitud) {
    return (
      <div className="mt-3">
        <p className="font-semibold">
          {miSolicitud.estado === 'aceptada'
            ? 'Aceptaron tu solicitud.'
            : 'Ya enviaste tu solicitud. Te avisaremos cuando la revisen.'}
        </p>
        {verCasos}
      </div>
    )
  }

  if (pin.tipo === 'rojo' && pin.encontrado) {
    return (
      <p className="mt-3 text-sm font-semibold text-tinta/70">
        Alguien ya dijo que lo encontró. Su dueño ya recibió el aviso.
      </p>
    )
  }
  // Pin rojo en el mapa o en la lista "Se busca"
  const puedeLoEncontre = pin.tipo === 'rojo' && (pin.estado === 'activo' || enSeBusca(pin))
  if (!reclamable && !puedeLoEncontre) return null
  if (!habilitado) return <p className="mt-3 text-sm font-semibold">{motivoSoloLectura}</p>

  if (formulario === 'es-mio') {
    return (
      <FormularioEsMio
        pin={pin}
        onCancelar={() => setFormulario(null)}
        onListo={() => setHecho('Solicitud enviada. Te avisaremos cuando la revisen.')}
      />
    )
  }
  if (formulario === 'lo-encontre') {
    return (
      <FormularioLoEncontre
        pin={pin}
        onCancelar={() => setFormulario(null)}
        onListo={() => setHecho('Listo: avisamos al dueño. Revisa Mis casos para la entrega.')}
      />
    )
  }
  return reclamable ? (
    <button
      type="button"
      className="boton boton-verde mt-3 w-full"
      onClick={() => setFormulario('es-mio')}
    >
      Es mío
    </button>
  ) : (
    <button
      type="button"
      className="boton boton-verde mt-3 w-full"
      onClick={() => setFormulario('lo-encontre')}
    >
      Lo encontré
    </button>
  )
}
