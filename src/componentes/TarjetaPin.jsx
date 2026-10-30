// Hoja con los datos de un pin al tocarlo en el mapa.
// Si el pin es verde y es tuyo, también muestra el dato ciego y la foto nítida (solo tú los ves).
// Abajo van las acciones del caso: "Es mío" o "Lo encontré" (ver AccionesPin).
import { useEffect, useState } from 'react'
import { nombreCategoria } from '../lib/categorias.js'
import { enlaceFoto, leerDatoCiego } from '../lib/pines.js'
import { haceCuanto } from '../lib/tiempo.js'
import { nombreCorto, zonaPorId } from '../mapa/zonas.js'
import AccionesPin from './AccionesPin.jsx'
import Hoja from './Hoja.jsx'

export default function TarjetaPin({
  pin,
  yo,
  habilitado = true,
  motivoSoloLectura,
  onVerCasos,
  onCerrar,
}) {
  const esMio = Boolean(yo) && pin.autorId === yo
  const [foto, setFoto] = useState(null)
  const [privado, setPrivado] = useState(null) // { dato, fotoNitida } para el autor

  useEffect(() => {
    let vigente = true
    if (pin.fotoPublica) enlaceFoto(pin.fotoPublica).then((url) => vigente && setFoto(url))
    if (esMio && pin.tipo === 'verde') {
      Promise.all([
        leerDatoCiego(pin.id),
        pin.tieneFotoNitida ? enlaceFoto(`${pin.id}/nitida.webp`) : null,
      ]).then(([dato, fotoNitida]) => vigente && setPrivado({ dato, fotoNitida }))
    }
    return () => {
      vigente = false
    }
  }, [pin, esMio])

  const lugar = nombreCorto(zonaPorId(pin.zonaId)) + (pin.piso ? `, ${pin.piso}` : '')
  return (
    <Hoja
      titulo={pin.titulo}
      subtitulo={`${nombreCategoria(pin.categoria)} · ${haceCuanto(pin.creado)}`}
      onCerrar={onCerrar}
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className={`etiqueta-tipo ${pin.tipo === 'rojo' ? 'bg-pin-rojo' : 'bg-pin-verde'}`}>
          {pin.tipo === 'rojo' ? 'Se perdió' : 'Se encontró'}
        </span>
        <span className="font-semibold">{lugar}</span>
      </p>
      {pin.descripcion && <p className="mt-2">{pin.descripcion}</p>}
      {foto && (
        <img
          src={foto}
          alt={pin.tipo === 'verde' ? 'Foto desenfocada del objeto' : `Foto de ${pin.titulo}`}
          className="mt-3 max-h-56 w-full rounded-2xl border-2 border-tinta/15 object-cover"
        />
      )}
      {privado && (
        <div className="privado mt-3">
          <p className="text-sm font-bold">Solo tú ves esto</p>
          <p>
            Dato ciego: <strong>{privado.dato}</strong>
          </p>
          {privado.fotoNitida && (
            <img
              src={privado.fotoNitida}
              alt="Foto nítida del objeto"
              className="mt-2 max-h-56 w-full rounded-xl object-cover"
            />
          )}
        </div>
      )}
      {yo && (
        <AccionesPin
          pin={pin}
          yo={yo}
          habilitado={habilitado}
          motivoSoloLectura={motivoSoloLectura}
          onVerCasos={onVerCasos}
        />
      )}
    </Hoja>
  )
}
