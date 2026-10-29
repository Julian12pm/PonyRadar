// Hoja que aparece al tocar el mapa: dice dónde cayó el toque y permite publicar un pin.
// Pin rojo: "Perdí algo aquí". Pin verde: "Encontré esto" con dato ciego y foto desenfocada.
import { MENSAJE_TITULO, tituloValido } from '../lib/validacion.js'
import { useState } from 'react'
import { CATEGORIAS } from '../lib/categorias.js'
import { GUIAS_FOTO, prepararFotos } from '../lib/fotos.js'
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
 *   zona: object|null,            zona detectada (null = fuera del campus)
 *   tipoInicial?: 'rojo'|'verde', si el usuario ya eligió "Perdí algo" o "Encontré algo"
 *   puedePublicar?: boolean,      false si la cuenta está suspendida o no hay conexión
 *   motivoSoloLectura?: string,   por qué no se puede publicar
 *   onPublicar: (datos) => Promise<void>, recibe { tipo, categoria, titulo, descripcion, piso,
 *                                  datoCiego, fotos }; si falla, lanza un error con su mensaje
 *   onCerrar: () => void
 * }} props
 */
export default function HojaLugar({
  zona,
  tipoInicial = null,
  puedePublicar = true,
  motivoSoloLectura = 'Tu cuenta está suspendida: puedes ver el mapa, pero no publicar pines.',
  onPublicar,
  onCerrar,
}) {
  const [tipo, setTipo] = useState(tipoInicial)
  const [categoria, setCategoria] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [piso, setPiso] = useState('')
  const [datoCiego, setDatoCiego] = useState('')
  const [foto, setFoto] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  if (!zona) {
    return (
      <Hoja titulo="Fuera del campus" onCerrar={onCerrar}>
        <p>Toca un punto dentro de la Unidad Central, Metal Mecánica o Posgrado.</p>
      </Hoja>
    )
  }

  const esVerde = tipo === 'verde'
  const listo = categoria && tituloValido(titulo) && (!esVerde || datoCiego.trim().length >= 3)
  // Solo se avisa cuando ya escribió algo que no sirve (no al abrir la hoja)
  const tituloMal = titulo.trim().length > 0 && !tituloValido(titulo)

  const publicar = async (e) => {
    e.preventDefault()
    if (!listo || ocupado) return
    setOcupado(true)
    setError('')
    try {
      const fotos = foto ? await prepararFotos(foto, tipo) : null
      await onPublicar({
        tipo,
        categoria,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        piso: piso.trim(),
        datoCiego: esVerde ? datoCiego.trim() : null,
        fotos,
      })
    } catch (err) {
      setError(err.message || 'No se pudo publicar. Intenta de nuevo.')
      setOcupado(false)
    }
  }

  return (
    <Hoja titulo={nombreCorto(zona)} subtitulo={describirZona(zona)} onCerrar={onCerrar}>
      {!puedePublicar ? (
        <p>{motivoSoloLectura}</p>
      ) : !tipo ? (
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
            <span>{esVerde ? '¿Qué encontraste?' : '¿Qué perdiste?'}</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={60}
              required
              aria-invalid={tituloMal}
              aria-describedby={tituloMal ? 'titulo-pin-error' : undefined}
              placeholder={esVerde ? 'Ej. Calculadora' : 'Ej. Calculadora Casio'}
            />
          </label>
          {/* Fuera de la etiqueta para no cambiar el nombre del campo; se liga con aria-describedby */}
          {tituloMal && (
            <p id="titulo-pin-error" className="-mt-1.5 text-sm font-semibold text-pin-rojo">
              {MENSAJE_TITULO}
            </p>
          )}
          <label className="campo">
            <span>Descripción (opcional)</span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={280}
              rows={2}
              placeholder={
                esVerde
                  ? 'Vaga: color o tipo general. Lo que lo identifica va en el dato ciego.'
                  : 'Color, marca, dónde estabas…'
              }
            />
          </label>

          {esVerde && (
            <label className="campo">
              <span>Dato ciego (solo tú lo verás)</span>
              <input
                value={datoCiego}
                onChange={(e) => setDatoCiego(e.target.value)}
                maxLength={200}
                required
                placeholder="Algo que solo el dueño sabría: una calcomanía, un nombre…"
              />
              <small className="font-normal text-tinta/65">
                Quien reclame el objeto tendrá que adivinarlo. No lo pongas en la descripción.
              </small>
            </label>
          )}

          <div className="campo">
            <span>Foto (opcional)</span>
            {/* La guía va fuera de la etiqueta y se asocia con aria-describedby */}
            {esVerde && (
              <p id="guia-foto" className="guia-foto">
                {categoria
                  ? GUIAS_FOTO[categoria]
                  : 'Elige la categoría para ver cómo tomar la foto.'}
              </p>
            )}
            {/* El selector nativo dice "Choose file" en inglés: se oculta y se usa un botón propio */}
            <label htmlFor="foto-pin" className="boton-archivo">
              {foto ? `Cambiar foto (${foto.name})` : 'Tomar o elegir foto'}
            </label>
            <input
              id="foto-pin"
              type="file"
              accept="image/*"
              className="sr-only"
              aria-describedby={esVerde ? 'guia-foto' : undefined}
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
            {esVerde && (
              <small className="font-normal text-tinta/65">
                En el mapa se publica muy desenfocada; la foto nítida solo la ves tú.
              </small>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-pin-rojo/12 px-3 pt-2 pb-1.5 text-sm font-semibold"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className={`boton ${esVerde ? 'boton-verde' : 'boton-rojo'}`}
            disabled={!listo || ocupado}
          >
            {ocupado ? 'Publicando…' : `Publicar pin ${esVerde ? 'verde' : 'rojo'}`}
          </button>
        </form>
      )}
    </Hoja>
  )
}
