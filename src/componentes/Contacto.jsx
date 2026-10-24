// Tarjeta de contacto de la otra parte del caso (solo existe después de aceptar la solicitud).
// La conversación es por Teams: no hay chat dentro de la app.
import { useEffect, useState } from 'react'
import { contactoDelCaso } from '../lib/casos.js'
import { enlaceTeams, mensajeInicial } from '../lib/teams.js'

export default function Contacto({ solicitudId, objeto }) {
  const [contacto, setContacto] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    contactoDelCaso(solicitudId)
      .then((c) => vigente && setContacto(c))
      .catch((e) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [solicitudId])

  if (error) return <p className="mt-2 text-sm text-pin-rojo">{error}</p>
  if (!contacto) return <p className="mt-2 text-sm text-tinta/60">Cargando contacto…</p>

  const quien = contacto.papel === 'encontro' ? 'Lo tiene' : 'Es de'
  return (
    <div className="contacto mt-3">
      <p className="text-sm text-tinta/70">{quien}</p>
      <p className="text-lg leading-tight font-extrabold">{contacto.nombre}</p>
      <p className="truncate text-sm">{contacto.correo}</p>
      <a
        className="boton-teams mt-2"
        href={enlaceTeams(contacto.correo, mensajeInicial(contacto.papel, objeto))}
        target="_blank"
        rel="noreferrer"
      >
        Escribir en Teams
      </a>
    </div>
  )
}
