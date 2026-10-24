// Mapa del campus con zoom y arrastre (react-zoom-pan-pinch).
// Capas, de abajo hacia arriba: croquis → pines → etiquetas (las etiquetas nunca quedan tapadas).

import { useLayoutEffect, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import campus from './campus-osm.json'
import { CapaBase, CapaEtiquetas } from './CroquisCampus.jsx'
import { caja } from './geometria.js'
import { encuadrar, nivelDetalle } from './vista.js'
import './croquis.css'

const LIMITES = campus.limites

// Convierte metros a píxeles del contenido (el contenido mide 1 px por metro a escala 1)
const aContenido = ([x, y]) => [x - LIMITES.x, y - LIMITES.y]

// Margen (en px) entre el campus y la orilla del mapa en la vista inicial
const MARGENES = { arriba: 6, abajo: 6, lados: 6 }

// Caja que se encuadra al inicio: las 3 unidades más el espacio de sus nombres
// (arriba de Metal Mecánica y abajo de Posgrado), en píxeles del contenido
const CAJA_CAMPUS = (() => {
  const { x0, y0, x1, y1 } = caja(campus.unidades.flatMap((u) => u.puntos))
  const [ax, ay] = aContenido([x0, y0 - 28])
  const [bx, by] = aContenido([x1, y1 + 22])
  return { x0: ax, y0: ay, x1: bx, y1: by }
})()

/** Alfiler de un pin (rojo = perdí, verde = encontré). */
function Alfiler({ tipo }) {
  const color = tipo === 'rojo' ? '#f2545b' : '#2fb36f'
  return (
    <svg width="30" height="44" viewBox="0 0 30 44" aria-hidden="true">
      <ellipse cx="15" cy="42" rx="5" ry="1.8" fill="#0003" />
      <rect x="13.7" y="20" width="2.6" height="22" rx="1.3" fill="#2b3a4a" />
      <circle cx="15" cy="13" r="11.5" fill={color} stroke="#2b3a4a" strokeWidth="2.5" />
      <circle cx="11.5" cy="9.5" r="3" fill="#fff" opacity=".55" />
    </svg>
  )
}

/** Elemento HTML anclado a un punto del mapa que conserva su tamaño en pantalla al hacer zoom. */
function Marcador({ punto, ancla = 'abajo', children, etiqueta }) {
  const [x, y] = aContenido(punto)
  return (
    <div
      className={`marcador marcador-${ancla}`}
      style={{ left: x, top: y }}
      role="img"
      aria-label={etiqueta}
    >
      {children}
    </div>
  )
}

/**
 * Ocupa todo su contenedor. Primero mide el espacio disponible y luego monta el mapa;
 * si cambia el tamaño (por ejemplo, al girar el celular) se vuelve a encuadrar.
 */
export default function MapaCampus(props) {
  const marco = useRef(null)
  const [tamano, setTamano] = useState(null)

  useLayoutEffect(() => {
    const el = marco.current
    const medir = () => setTamano({ ancho: el.clientWidth, alto: el.clientHeight })
    medir()
    if (typeof ResizeObserver === 'undefined') return // en las pruebas (jsdom) no existe
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  const listo = tamano && tamano.ancho > 0 && tamano.alto > 0
  return (
    <div ref={marco} className="absolute inset-0">
      {listo && <Lienzo key={`${tamano.ancho}x${tamano.alto}`} tamano={tamano} {...props} />}
    </div>
  )
}

function Lienzo({ tamano, pines = [], grupos = [], seguros = [] }) {
  const contenido = useRef(null)
  // Encuadre inicial: las 3 unidades ocupan todo el espacio disponible, con un margen mínimo
  const [inicial] = useState(() => encuadrar(CAJA_CAMPUS, tamano, MARGENES))

  // Pasa la escala actual al CSS: tamaño fijo de etiquetas y nivel de detalle
  const aplicarEscala = (escala) => {
    const el = contenido.current
    if (!el) return
    el.style.setProperty('--k', escala)
    el.dataset.detalle = nivelDetalle(escala)
  }
  useLayoutEffect(() => aplicarEscala(inicial.escala), [inicial.escala])

  return (
    <TransformWrapper
      initialScale={inicial.escala}
      initialPositionX={inicial.x}
      initialPositionY={inicial.y}
      // No se puede alejar más que el encuadre inicial ni arrastrar el campus fuera de la vista
      minScale={inicial.escala}
      maxScale={5}
      limitToBounds
      centerZoomedOut
      doubleClick={{ disabled: true }}
      onTransform={(_, estado) => aplicarEscala(estado.scale)}
    >
      <TransformComponent wrapperClass="mapa-envoltura" contentClass="mapa-contenido">
        <div
          ref={contenido}
          className="croquis"
          style={{ width: LIMITES.ancho, height: LIMITES.alto }}
        >
          <CapaBase />
          <div className="capa-pines">
            {seguros.map((s) => (
              <Marcador
                key={s.id}
                punto={s.punto}
                ancla="centro"
                etiqueta={`Punto seguro: ${s.cantidad} objetos`}
              >
                <span className="seguro">
                  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" />
                  </svg>
                  {s.cantidad}
                </span>
              </Marcador>
            ))}
            {grupos.map((g) => (
              <Marcador key={g.id} punto={g.punto} ancla="centro" etiqueta={`${g.cantidad} pines`}>
                <span className="grupo">{g.cantidad}</span>
              </Marcador>
            ))}
            {pines.map((p) => (
              <Marcador
                key={p.id}
                punto={p.punto}
                etiqueta={p.tipo === 'rojo' ? 'Perdido' : 'Encontrado'}
              >
                <Alfiler tipo={p.tipo} />
              </Marcador>
            ))}
          </div>
          <CapaEtiquetas />
        </div>
      </TransformComponent>
    </TransformWrapper>
  )
}
