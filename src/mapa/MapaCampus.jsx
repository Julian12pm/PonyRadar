// Mapa del campus con zoom y arrastre (react-zoom-pan-pinch).
// Capas, de abajo hacia arriba: croquis → pines → etiquetas (las etiquetas nunca quedan tapadas).

import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { agrupar, escalaParaSeparar } from './agrupacion.js'
import { CAJAS_UNIDADES, EDIFICIOS, LIMITES } from './campus.js'
import { CapaBase, CapaEtiquetas } from './CroquisCampus.jsx'
import { letrasTapadas } from './colisiones.js'
import { unidadDePunto } from './deteccion.js'
import {
  areaVisible,
  encuadrar,
  nivelDetalle,
  nivelLetras,
  pantallaAMetros,
  rellenar,
} from './vista.js'
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
const ESCALA_MAXIMA = 5
// Un toque es un "tap" si el dedo casi no se movió y no duró mucho (si no, fue un arrastre)
const TOQUE = { distanciaPx: 8, duracionMs: 500 }

/** Encuadre de cada botón de salto. */
function objetivoDe(id, pantalla) {
  if (id === 'todo') return encuadrar(CAJA_TODO, pantalla, MARGENES)
  return rellenar(cajaContenido(CAJAS_UNIDADES[id], 10, 10), CONTENIDO, pantalla)
}

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

/**
 * Botón anclado a un punto del mapa que conserva su tamaño en pantalla al hacer zoom.
 * Sin `onClick` se dibuja como elemento decorativo.
 */
function Marcador({ punto, ancla = 'abajo', children, etiqueta, onClick, clase = '' }) {
  const [x, y] = aContenido(punto)
  return (
    <div className={`marcador marcador-${ancla} ${clase}`} style={{ left: x, top: y }}>
      {onClick ? (
        <button type="button" className="marcador-boton" aria-label={etiqueta} onClick={onClick}>
          {children}
        </button>
      ) : (
        <span aria-hidden="true">{children}</span>
      )}
    </div>
  )
}

/**
 * Ocupa todo su contenedor. Primero mide el espacio disponible y luego monta el mapa.
 * Si después cambia el tamaño (en el celular pasa al ocultarse la barra de direcciones o al
 * abrirse el teclado), el mapa NO se reinicia: conserva el zoom y el punto que estaba al centro.
 *
 * Props:
 * - pines: [{ id, tipo: 'rojo'|'verde', punto: [x, y] (metros), … }] (ya filtrados)
 * - seguros: puntos seguros [{ id, cantidad, punto }]
 * - elegido: punto (metros) marcado con un aro, por ejemplo donde se tocó, o null
 * - onTocarMapa(punto): toque (sin arrastre) en cualquier lugar del mapa
 * - onTocarPin(pin) / onTocarSeguro(seguro)
 * - onTocarGrupo(pines): burbuja cuyos pines no se separan ni con el zoom máximo
 * - onFueraDeVista(cuentas): cuántos pines de cada unidad quedan fuera de la vista
 * - ref: expone saltar(id) para ir a una unidad ('unidad-central', …) o a 'todo'
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
      {listo && <Lienzo api={ref} tamano={tamano} {...props} />}
    </div>
  )
}

function Lienzo({
  api,
  tamano,
  pines = [],
  seguros = [],
  elegido = null,
  onTocarMapa,
  onTocarPin,
  onTocarGrupo,
  onTocarSeguro,
  onFueraDeVista,
}) {
  const contenido = useRef(null)
  const control = useRef(null)
  const espera = useRef(null)
  const toque = useRef(null) // datos del dedo/ratón mientras está abajo

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

  const irA = (o) => control.current?.setTransform(o.x, o.y, o.escala, 450, 'easeOut')

  // Si cambia el tamaño del mapa, se mantiene el mismo zoom y el mismo punto al centro
  const tamanoPrevio = useRef(tamano)
  useEffect(() => {
    const previo = tamanoPrevio.current
    tamanoPrevio.current = tamano
    const estado = control.current?.instance.state
    if (!estado || (previo.ancho === tamano.ancho && previo.alto === tamano.alto)) return
    control.current.setTransform(
      estado.positionX + (tamano.ancho - previo.ancho) / 2,
      estado.positionY + (tamano.alto - previo.alto) / 2,
      estado.scale,
      0,
    )
  }, [tamano])

  // Salto animado a una unidad o a todo el campus
  useImperativeHandle(api, () => ({ saltar: (id) => irA(objetivoDe(id, tamano)) }), [tamano])

  // Al tocar una burbuja se acerca el mapa sobre ella hasta que sus pines se separen.
  // Si ni con el zoom máximo se separan (están casi en el mismo punto), se muestra la lista.
  const abrirGrupo = (grupo) => {
    const necesaria = escalaParaSeparar(grupo.pines)
    if (necesaria > ESCALA_MAXIMA && vista.escala >= ESCALA_MAXIMA * 0.95) {
      onTocarGrupo?.(grupo.pines)
      return
    }
    const escala = Math.min(ESCALA_MAXIMA, Math.max(necesaria, vista.escala * 1.5))
    const [px, py] = aContenido(grupo.punto)
    irA({ escala, x: tamano.ancho / 2 - px * escala, y: tamano.alto / 2 - py * escala })
  }

  // ─── Toques: se distingue un toque de un arrastre o de un pellizco ───
  const alBajar = (e) => {
    if (e.target.closest('.marcador-boton')) return
    const previo = toque.current
    // Un segundo dedo convierte el gesto en pellizco: ya no cuenta como toque
    toque.current = previo
      ? { ...previo, multiple: true }
      : { x: e.clientX, y: e.clientY, inicio: e.timeStamp, multiple: false }
  }
  const alSubir = (e) => {
    const t = toque.current
    toque.current = null
    if (!t || t.multiple || !onTocarMapa) return
    const movido = Math.hypot(e.clientX - t.x, e.clientY - t.y)
    if (movido > TOQUE.distanciaPx || e.timeStamp - t.inicio > TOQUE.duracionMs) return
    const rect = contenido.current.getBoundingClientRect()
    onTocarMapa(pantallaAMetros({ x: e.clientX, y: e.clientY }, rect, LIMITES))
  }

  // Agrupación según el zoom: los pines que quedarían encimados se juntan en una burbuja
  const grupos = useMemo(() => agrupar(pines, vista.escala), [pines, vista.escala])

  // Pines de cada unidad que quedan fuera de la vista actual (para el contador de los botones)
  const fueraDeVista = useMemo(() => {
    const v = areaVisible(vista, tamano)
    const cuenta = {}
    for (const p of pines) {
      const [x, y] = aContenido(p.punto)
      if (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1) continue
      const unidad = unidadDePunto(p.punto)
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
          ...grupos.map((g) =>
            g.pines.length === 1
              ? { punto: g.punto, forma: 'alfiler' }
              : { punto: g.punto, forma: 'circulo', radio: 22 },
          ),
          ...seguros.map((s) => ({ punto: s.punto, forma: 'circulo', radio: 22 })),
        ],
        vista.escala,
      ),
    [grupos, seguros, vista.escala],
  )

  return (
    <TransformWrapper
      ref={control}
      initialScale={inicial.escala}
      initialPositionX={inicial.x}
      initialPositionY={inicial.y}
      // No se puede alejar más que "Ver todo" ni arrastrar el campus fuera de la vista
      minScale={minimo}
      maxScale={ESCALA_MAXIMA}
      limitToBounds
      centerZoomedOut
      doubleClick={{ disabled: true }}
      // Tocar un pin, una burbuja o un punto seguro nunca arrastra el mapa
      panning={{ excluded: ['marcador-boton'] }}
      onTransform={(_, estado) => alMover(estado)}
    >
      <TransformComponent wrapperClass="mapa-envoltura" contentClass="mapa-contenido">
        <div
          ref={contenido}
          className="croquis"
          style={{ width: LIMITES.ancho, height: LIMITES.alto }}
          onPointerDown={alBajar}
          onPointerUp={alSubir}
          onPointerCancel={() => (toque.current = null)}
        >
          <CapaBase />
          <div className="capa-pines">
            {elegido && (
              <Marcador punto={elegido} ancla="centro" clase="marcador-elegido">
                <span className="punto-elegido" />
              </Marcador>
            )}
            {seguros.map((s) => (
              <Marcador
                key={s.id}
                punto={s.punto}
                ancla="centro"
                etiqueta={`Punto seguro ${s.nombre}: ${s.cantidad} objetos en resguardo`}
                onClick={() => onTocarSeguro?.(s)}
              >
                <span className="seguro">
                  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" />
                  </svg>
                  {s.cantidad}
                </span>
              </Marcador>
            ))}
            {grupos.map((g) =>
              g.pines.length > 1 ? (
                <Marcador
                  key={g.id}
                  punto={g.punto}
                  ancla="centro"
                  etiqueta={`${g.pines.length} pines aquí; toca para acercar`}
                  onClick={() => abrirGrupo(g)}
                >
                  <span className="grupo">{g.pines.length}</span>
                </Marcador>
              ) : (
                <Marcador
                  key={g.pines[0].id}
                  punto={g.pines[0].punto}
                  etiqueta={`${g.pines[0].tipo === 'rojo' ? 'Perdido' : 'Encontrado'}: ${g.pines[0].titulo}`}
                  onClick={() => onTocarPin?.(g.pines[0])}
                >
                  <Alfiler tipo={g.pines[0].tipo} />
                </Marcador>
              ),
            )}
          </div>
          <CapaEtiquetas tapadas={tapadas} />
        </div>
      </TransformComponent>
    </TransformWrapper>
  )
}
