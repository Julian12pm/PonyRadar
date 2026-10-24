// Hoja que aparece al tocar el mapa: dice dónde cayó el toque y permite crear un pin de prueba.
import { useState } from 'react'
import { CATEGORIAS } from '../lib/categorias.js'
import { campus } from '../mapa/campus.js'
import { nombreCorto } from '../mapa/zonas.js'
import Hoja from './Hoja.jsx'

/** Subtítulo de la zona: nombre del edificio según la leyenda, y su unidad. */
function describirZona(zona) {
  const unidad = campus.unidades.find((u) => u.id === zona.unidad)?.nombre
  if (zona.tipo === 'edificio') return `${zona.nombre} · ${unidad}`
  if (zona.subtipo === 'jardin') return 'Área abierta'
  return unidad
}

/**
 * @param {{
 *   zona: object|null,           zona detectada (null = fuera del campus)
 *   tipoInicial?: 'rojo'|'verde', si el usuario ya eligió "Perdí algo" o "Encontré algo"
 *   onPublicar: (datos) => void, recibe { tipo, categoria, titulo, descripcion, piso }
 *   onCerrar: () => void
 * }} props
 */
export default function HojaLugar({ zona, tipoInicial = null, onPublicar, onCerrar }) {
  const [tipo, setTipo] = useState(tipoInicial)
  const [categoria, setCategoria] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [piso, setPiso] = useState('')

  if (!zona) {
    return (
      <Hoja titulo="Fuera del campus" onCerrar={onCerrar}>
        <p>Toca un punto dentro de la Unidad Central, Metal Mecánica o Posgrado.</p>
      </Hoja>
    )
  }

  const listo = categoria && titulo.trim().length >= 3
  const publicar = (e) => {
    e.preventDefault()
    if (!listo) return
    onPublicar({
      tipo,
      categoria,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      piso: piso.trim(),
    })
  }

  return (
    <Hoja titulo={nombreCorto(zona)} subtitulo={describirZona(zona)} onCerrar={onCerrar}>
      {!tipo ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" className="boton boton-rojo" onClick={() => setTipo('rojo')}>
            Perdí algo aquí
          </button>
          <button type="button" className="boton boton-verde" onClick={() => setTipo('verde')}>
            Encontré algo aquí
          </button>
        </div>
      ) : (
        <form className="grid gap-2.5" onSubmit={publicar}>
          {zona.tipo === 'edificio' && (
            <label className="campo">
              <span>Piso o salón (opcional)</span>
              <input
                value={piso}
                onChange={(e) => setPiso(e.target.value)}
                maxLength={30}
                placeholder="Ej. 2.º piso, salón K-12"
              />
            </label>
          )}
          <label className="campo">
            <span>Categoría</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} required>
              <option value="" disabled>
                Elige una categoría
              </option>
              {CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>{tipo === 'rojo' ? '¿Qué perdiste?' : '¿Qué encontraste?'}</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={60}
              required
              placeholder={tipo === 'rojo' ? 'Ej. Calculadora Casio' : 'Ej. Calculadora'}
            />
          </label>
          <label className="campo">
            <span>Descripción (opcional)</span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={280}
              rows={2}
              placeholder={
                tipo === 'verde'
                  ? 'Descríbelo de forma vaga; los detalles que lo identifican se guardan aparte'
                  : 'Color, marca, dónde estabas…'
              }
            />
          </label>
          <button
            type="submit"
            className={`boton ${tipo === 'rojo' ? 'boton-rojo' : 'boton-verde'}`}
            disabled={!listo}
          >
            Publicar pin {tipo === 'rojo' ? 'rojo' : 'verde'}
          </button>
          <p className="text-center text-xs text-tinta/60">
            Versión de prueba: el pin se guarda solo en este navegador hasta que recargues.
          </p>
        </form>
      )}
    </Hoja>
  )
}
