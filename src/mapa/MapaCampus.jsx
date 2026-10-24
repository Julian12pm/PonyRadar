// Mapa del campus con zoom y arrastre (react-zoom-pan-pinch).
// Capas, de abajo hacia arriba: croquis → pines → etiquetas (las etiquetas nunca quedan tapadas).

import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { CAJAS_UNIDADES, EDIFICIOS, LIMITES, campus } from './campus.js'
import { CapaBase, CapaEtiquetas } from './CroquisCampus.jsx'
import { letrasTapadas } from './colisiones.js'
import { dentro } from './geometria.js'
import { areaVisible, encuadrar, nivelDetalle, nivelLetras, rellenar } from './vista.js'
import './croquis.css'

// Convierte metros a píxeles del contenido (el contenido mide 1 px por metro a escala 1)
const aContenido = ([x, y]) => [x - LIMITES.x, y - LIMITES.y]
const CONTENIDO = { ancho: LIMITES.ancho, alto: LIMITES.alto }

/** Caja en metros → caja en píxeles del contenido, con margen opcional arriba y abajo. */
function cajaContenido({ x0, y0, x1, y1 }, arriba = 0, abajo = 0) {
  const [ax, ay] = aContenido([x0, y0 - arriba])
  const [bx, by] = aContenido([x1, y1 + abajo])
  return { x0: ax, y0: ay, x1: bx, y1: by }
}

// Las 3 unidades más el espacio de sus nombres (arriba de Metal Mecánica y abajo de Posgrado)
const CAJA_TODO = cajaContenido(
  {
    x0: Math.min(...Object.values(CAJAS_UNIDADES).map((c) => c.x0)),
    y0: Math.min(...Object.values(CAJAS_UNIDADES).map((c) => c.y0)),
    x1: Math.max(...Object.values(CAJAS_UNIDADES).map((c) => c.x1)),
    y1: Math.max(...Object.values(CAJAS_UNIDADES).map((c) => c.y1)),
  },
  28,
  22,
)

const MARGENES = { arriba: 6, abajo: 6, lados: 6 }
const ANCHO_ESCRITORIO = 700 // a partir de aquí la vista inicial muestra las 3 unidades

/** Encuadre de cada botón de salto. */
function objetivoDe(id, pantalla) {
  if (id === 'todo') return encuadrar(CAJA_TODO, pantalla, MARGENES)
  return rellenar(cajaContenido(CAJAS_UNIDADES[id], 10, 10), CONTENIDO, pantalla)
}

/** Unidad (id) en la que cae un punto, o null. */
const unidadDe = (punto) => campus.unidades.find((u) => dentro(punto, u.puntos))?.id ?? null

// Letras de edificio (para saber cuáles quedan bajo un pin)
const LETRAS = EDIFICIOS.filter((e) => e.clave !== 'Ponyplaza').map((e) => ({
  id: e.id,
  punto: e.etiqueta,
  texto: e.clave,
}))

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
 *
 * `ref` expone `saltar(id)` para ir a una unidad ('unidad-central', …) o a 'todo'.
 * `onFueraDeVista(cuentas)` avisa cuántos pines de cada unidad quedan fuera de la vista.
 */
export default function MapaCampus({ ref, ...props }) {
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
      {listo && (
        <Lienzo key={`${tamano.ancho}x${tamano.alto}`} api={ref} tamano={tamano} {...props} />
      )}
    </div>
  )
}

function Lienzo({ api, tamano, pines = [], grupos = [], seguros = [], onFueraDeVista }) {
  const contenido = useRef(null)
  const control = useRef(null)
  const espera = useRef(null)

  // Celular: arranca en la Unidad Central llenando la pantalla. Escritorio: las 3 unidades.
  const [inicial] = useState(() =>
    tamano.ancho < ANCHO_ESCRITORIO
      ? objetivoDe('unidad-central', tamano)
      : objetivoDe('todo', tamano),
  )
  const minimo = useMemo(() => objetivoDe('todo', tamano).escala, [tamano])
  // Vista "estable": se actualiza cuando el usuario deja de mover el mapa
  const [vista, setVista] = useState(inicial)

  // Pasa la escala actual al CSS: tamaño fijo de etiquetas y niveles de detalle
  const aplicarEscala = (escala) => {
    const el = contenido.current
    if (!el) return
    el.style.setProperty('--k', escala)
    el.dataset.detalle = nivelDetalle(escala)
    el.dataset.letras = nivelLetras(escala)
  }
  useLayoutEffect(() => aplicarEscala(inicial.escala), [inicial.escala])

  const alMover = (estado) => {
    aplicarEscala(estado.scale)
    clearTimeout(espera.current)
    espera.current = setTimeout(
      () => setVista({ escala: estado.scale, x: estado.positionX, y: estado.positionY }),
      150,
    )
  }

  // Salto animado a una unidad o a todo el campus
  useImperativeHandle(
    api,
    () => ({
      saltar(id) {
        const o = objetivoDe(id, tamano)
        control.current?.setTransform(o.x, o.y, o.escala, 450, 'easeOut')
      },
    }),
    [tamano],
  )

  // Pines de cada unidad que quedan fuera de la vista actual (para el contador de los botones)
  const fueraDeVista = useMemo(() => {
    const v = areaVisible(vista, tamano)
    const cuenta = {}
    for (const p of pines) {
      const [x, y] = aContenido(p.punto)
      if (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1) continue
      const unidad = unidadDe(p.punto)
      if (unidad) cuenta[unidad] = (cuenta[unidad] ?? 0) + 1
    }
    return cuenta
  }, [pines, vista, tamano])
  useEffect(() => onFueraDeVista?.(fueraDeVista), [fueraDeVista, onFueraDeVista])

  // Letras que quedan bajo un pin, una burbuja o un punto seguro
  const tapadas = useMemo(
    () =>
      letrasTapadas(
        LETRAS,
        [
          ...pines.map((p) => ({ punto: p.punto, forma: 'alfiler' })),
          ...grupos.map((g) => ({ punto: g.punto, forma: 'circulo', radio: 22 })),
          ...seguros.map((s) => ({ punto: s.punto, forma: 'circulo', radio: 22 })),
        ],
        vista.escala,
      ),
    [pines, grupos, seguros, vista.escala],
  )

  return (
    <TransformWrapper
      ref={control}
      initialScale={inicial.escala}
      initialPositionX={inicial.x}
      initialPositionY={inicial.y}
      // No se puede alejar más que "Ver todo" ni arrastrar el campus fuera de la vista
      minScale={minimo}
      maxScale={5}
      limitToBounds
      centerZoomedOut
      doubleClick={{ disabled: true }}
      onTransform={(_, estado) => alMover(estado)}
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
          <CapaEtiquetas tapadas={tapadas} />
        </div>
      </TransformComponent>
    </TransformWrapper>
  )
}
