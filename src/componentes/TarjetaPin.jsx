// Hoja con los datos de un pin al tocarlo en el mapa.
import { nombreCategoria } from '../lib/categorias.js'
import { haceCuanto } from '../lib/tiempo.js'
import { nombreCorto, zonaPorId } from '../mapa/zonas.js'
import Hoja from './Hoja.jsx'

export default function TarjetaPin({ pin, onCerrar }) {
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
    </Hoja>
  )
}
