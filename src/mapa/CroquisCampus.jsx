// Croquis ilustrado del campus, dibujado en SVG a partir de los datos de OpenStreetMap.
// Las coordenadas están en metros (ver scripts/osm/convertir.mjs).
//
// Se divide en dos capas con el mismo sistema de coordenadas:
//   <CapaBase>       terreno, calles, canchas, árboles y edificios
//   <CapaEtiquetas>  letras y nombres; va ENCIMA de los pines para que nunca queden tapados
//
// El nivel de detalle lo controla la clase CSS del contenedor (data-detalle = 1, 2 o 3):
// los elementos con clase d2 o d3 solo aparecen al acercar (ver croquis.css).

import {
  CALLES_CON_NOMBRE,
  EDIFICIOS,
  ESTACIONAMIENTOS_ROTULADOS,
  LIMITES,
  NOMBRES_UNIDADES,
  VOLUMENES,
  campus,
} from './campus.js'
import { aPuntosSvg, aRuta, muros, puntoEtiqueta, rectanguloOrientado } from './geometria.js'

const VIEWBOX = `${LIMITES.x} ${LIMITES.y} ${LIMITES.ancho} ${LIMITES.alto}`

// ─── Piezas de dibujo ───

/** Líneas blancas de una cancha o campo, dibujadas en el sistema del rectángulo orientado. */
function LineasCancha({ puntos, deporte }) {
  const { cx, cy, largo: L, ancho: A, angulo } = rectanguloOrientado(puntos)
  const m = Math.min(L, A) * 0.06 // margen entre el borde y la línea exterior
  const l = L / 2 - m
  const a = A / 2 - m
  return (
    <g className="lineas-cancha" transform={`translate(${cx} ${cy}) rotate(${angulo})`}>
      {/* El borde se ve siempre (así se lee como cancha al alejar); lo demás, al acercar */}
      <rect x={-l} y={-a} width={l * 2} height={a * 2} />
      <g className="d2">
        <line x1={0} y1={-a} x2={0} y2={a} />
        {deporte === 'futbol' && (
          <>
            <circle r={A * 0.13} />
            <rect x={-l} y={-A * 0.3} width={L * 0.16} height={A * 0.6} />
            <rect x={l - L * 0.16} y={-A * 0.3} width={L * 0.16} height={A * 0.6} />
            <rect x={-l} y={-A * 0.14} width={L * 0.055} height={A * 0.28} />
            <rect x={l - L * 0.055} y={-A * 0.14} width={L * 0.055} height={A * 0.28} />
          </>
        )}
        {deporte === 'basquet' && (
          <>
            <circle r={A * 0.12} />
            <rect x={-l} y={-A * 0.16} width={L * 0.2} height={A * 0.32} />
            <rect x={l - L * 0.2} y={-A * 0.16} width={L * 0.2} height={A * 0.32} />
            <path d={`M${-l} ${-a * 0.85} A${a * 0.85} ${a * 0.85} 0 0 1 ${-l} ${a * 0.85}`} />
            <path d={`M${l} ${-a * 0.85} A${a * 0.85} ${a * 0.85} 0 0 0 ${l} ${a * 0.85}`} />
          </>
        )}
        {deporte === 'voleibol' && (
          <>
            <line x1={-L / 6} y1={-a} x2={-L / 6} y2={a} />
            <line x1={L / 6} y1={-a} x2={L / 6} y2={a} />
            <line className="red" x1={0} y1={-a - m * 0.6} x2={0} y2={a + m * 0.6} />
          </>
        )}
      </g>
    </g>
  )
}

/** Franjas de pasto podado en los campos de fútbol. */
function Franjas({ puntos }) {
  const { cx, cy, largo: L, ancho: A, angulo } = rectanguloOrientado(puntos)
  const n = 10
  return (
    <g className="franjas d2" transform={`translate(${cx} ${cy}) rotate(${angulo})`}>
      {Array.from({ length: n / 2 }, (_, i) => (
        <rect key={i} x={-L / 2 + (L / n) * i * 2} y={-A / 2} width={L / n} height={A} />
      ))}
    </g>
  )
}

/** Alberca: borde, agua y carriles. */
function Alberca({ puntos }) {
  const { cx, cy, largo: L, ancho: A, angulo } = rectanguloOrientado(puntos)
  const borde = 1.2
  const carriles = Math.max(3, Math.round((A - borde * 2) / 2.5))
  const anchoCarril = (A - borde * 2) / carriles
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${angulo})`}>
      <rect className="alberca-borde" x={-L / 2} y={-A / 2} width={L} height={A} rx={0.8} />
      <rect
        className="alberca-agua"
        x={-L / 2 + borde}
        y={-A / 2 + borde}
        width={L - borde * 2}
        height={A - borde * 2}
      />
      <g className="d2">
        {Array.from({ length: carriles }, (_, i) => {
          const y = -A / 2 + borde + anchoCarril * (i + 0.5)
          return (
            <line
              key={`f${i}`}
              className="alberca-fondo"
              x1={-L / 2 + 3}
              y1={y}
              x2={L / 2 - 3}
              y2={y}
            />
          )
        })}
        {Array.from({ length: carriles - 1 }, (_, i) => {
          const y = -A / 2 + borde + anchoCarril * (i + 1)
          return (
            <line
              key={`c${i}`}
              className="alberca-carril"
              x1={-L / 2 + borde}
              y1={y}
              x2={L / 2 - borde}
              y2={y}
            />
          )
        })}
      </g>
    </g>
  )
}

/** Ruta con forma de estadio (dos rectas y dos medias vueltas) centrada en el origen. */
function estadio(recta, radio) {
  const s = recta / 2
  return `M${-s} ${-radio}L${s} ${-radio}A${radio} ${radio} 0 0 1 ${s} ${radio}L${-s} ${radio}A${radio} ${radio} 0 0 1 ${-s} ${-radio}Z`
}

/** Pista de atletismo con carriles, ajustada al anillo de OSM. */
function Pista({ exterior, interior }) {
  const ext = rectanguloOrientado(exterior)
  const int = rectanguloOrientado(interior)
  const radioExt = ext.ancho / 2
  const radioInt = int.ancho / 2
  const recta = ext.largo - ext.ancho
  const carriles = 6
  return (
    <g transform={`translate(${ext.cx} ${ext.cy}) rotate(${ext.angulo})`}>
      <path className="pista" d={estadio(recta, radioExt)} />
      <path className="pista-interior" d={estadio(recta, radioInt)} />
      <g className="pista-carril d2">
        {Array.from({ length: carriles - 1 }, (_, i) => (
          <path
            key={i}
            d={estadio(recta, radioInt + ((radioExt - radioInt) * (i + 1)) / carriles)}
          />
        ))}
      </g>
    </g>
  )
}

/** Estacionamiento con cajones (las líneas se recortan a la forma del estacionamiento). */
function Estacionamiento({ id, puntos, indice }) {
  const { cx, cy, largo: L, ancho: A, angulo } = rectanguloOrientado(puntos)
  const idRecorte = `recorte-est-${indice}`
  const cajones = Math.floor(L / 2.6)
  const pasillo = A > 16 ? 6.5 : 0
  return (
    <g data-zona={id}>
      <clipPath id={idRecorte}>
        <polygon points={aPuntosSvg(puntos)} />
      </clipPath>
      <polygon className="estacionamiento" points={aPuntosSvg(puntos)} />
      <g className="d2" clipPath={`url(#${idRecorte})`}>
        <g transform={`translate(${cx} ${cy}) rotate(${angulo})`}>
          {Array.from({ length: cajones }, (_, i) => {
            const x = -L / 2 + 2.6 * (i + 0.5)
            return <line key={i} className="cajon" x1={x} y1={-A / 2} x2={x} y2={A / 2} />
          })}
          {pasillo > 0 && (
            <rect
              className="estacionamiento"
              x={-L / 2}
              y={-pasillo / 2}
              width={L}
              height={pasillo}
            />
          )}
        </g>
      </g>
    </g>
  )
}

/** Edificio en volumen: sombra, muros y techo. */
function Edificio({ e }) {
  return (
    <g data-zona={e.id}>
      <polygon className="sombra" points={aPuntosSvg(e.puntos, e.alto * 0.45, e.alto * 0.2)} />
      {muros(e.puntos, e.alto).map((m, i) => (
        <polygon
          key={i}
          className={m.luz > 0.5 ? 'muro-frente' : 'muro-lado'}
          points={aPuntosSvg(m.puntos)}
        />
      ))}
      <polygon
        className={e.clave === 'Ponyplaza' ? 'techo techo-plaza' : 'techo'}
        points={aPuntosSvg(e.puntos, 0, -e.alto)}
      />
    </g>
  )
}

/** Construcciones menores (techados): volumen bajo y color claro. */
function Techado({ puntos }) {
  return (
    <g>
      {muros(puntos, 2).map((m, i) => (
        <polygon key={i} className="techado-muro" points={aPuntosSvg(m.puntos)} />
      ))}
      <polygon className="techado" points={aPuntosSvg(puntos, 0, -2)} />
    </g>
  )
}

// ─── Capas ───

export function CapaBase() {
  return (
    <svg className="capa-croquis" viewBox={VIEWBOX} aria-hidden="true">
      <rect
        className="fondo"
        x={LIMITES.x}
        y={LIMITES.y}
        width={LIMITES.ancho}
        height={LIMITES.alto}
      />

      {/* Calles perimetrales: líneas simples sobre el fondo liso */}
      {campus.calles.map((c, i) => (
        <path key={i} className={`calle ${c.clase}`} d={aRuta(c.puntos)} />
      ))}

      {/* Terreno de las 3 unidades */}
      {campus.unidades.map((u) => (
        <polygon key={u.id} className="terreno" data-zona={u.id} points={aPuntosSvg(u.puntos)} />
      ))}
      {campus.pasto.map((p, i) => (
        <polygon key={i} className="pasto" points={aPuntosSvg(p)} />
      ))}
      {campus.bosque.map((p, i) => (
        <polygon key={i} className="bosque" points={aPuntosSvg(p)} />
      ))}

      {/* Calles internas y estacionamientos */}
      {campus.internas.map((p, i) => (
        <path key={i} className="interna-borde" d={aRuta(p)} />
      ))}
      {campus.internas.map((p, i) => (
        <path key={i} className="interna" d={aRuta(p)} />
      ))}
      {campus.estacionamientos.map((e, i) => (
        <Estacionamiento key={i} indice={i} {...e} />
      ))}

      {/* Deportes */}
      <Pista {...campus.pista} />
      {campus.campos.map((c) => (
        <g key={c.id} data-zona={c.id}>
          <polygon className="campo" points={aPuntosSvg(c.puntos)} />
          <Franjas puntos={c.puntos} />
          <LineasCancha puntos={c.puntos} deporte="futbol" />
        </g>
      ))}
      {campus.canchas.map((c) => (
        <g key={c.id} data-zona={c.id}>
          <polygon className={`cancha cancha-${c.deporte}`} points={aPuntosSvg(c.puntos)} />
          <LineasCancha puntos={c.puntos} deporte={c.deporte} />
        </g>
      ))}
      <g data-zona="alberca">
        <Alberca puntos={campus.alberca.puntos} />
      </g>

      {/* Andadores: borde y relleno por separado para que se unan en los cruces */}
      {campus.andadores.map((a, i) => (
        <path key={i} className="andador-borde" d={aRuta(a.puntos)} />
      ))}
      {campus.andadores.map((a, i) => (
        <path
          key={i}
          className={a.tipo === 'escalera' ? 'escalera' : 'andador'}
          d={aRuta(a.puntos)}
        />
      ))}

      {/* Árboles */}
      <g className="arboles">
        {campus.arboles.map(([x, y, r], i) => (
          <g key={i}>
            <ellipse
              className="arbol-sombra"
              cx={x + r * 0.7}
              cy={y + r * 0.45}
              rx={r}
              ry={r * 0.7}
            />
            <circle className="arbol" cx={x} cy={y - r * 0.3} r={r} />
            <circle className="arbol-luz" cx={x - r * 0.3} cy={y - r * 0.65} r={r * 0.45} />
          </g>
        ))}
      </g>

      {/* Construcciones */}
      {campus.techados.map((p, i) => (
        <Techado key={i} puntos={p} />
      ))}
      {VOLUMENES.map((e, i) => (
        <Edificio key={i} e={e} />
      ))}
    </svg>
  )
}

// Íconos de lugares (trazos de 24 × 24)
const ICONOS = {
  escolares: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5',
  comida: 'M7 3v8M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-2.2 1.2-3 3.8-3 7.5h3M17 3v18',
  biblioteca: 'M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z',
  cafeteria:
    'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c-.9 1 .9 2 0 3M12 3.5c-.9 1 .9 2 0 3',
  comedor: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM3 4v6M3 10v10M21 4c-1.6.9-2 3-2 6h2v10',
}

/** Ícono de un lugar (comida, biblioteca…) junto a la letra de su edificio. Tamaño fijo en pantalla. */
function Lugar({ tipo, nombre, edificio, lado = 'derecha' }) {
  const e = EDIFICIOS.find((x) => x.id === edificio)
  // Ponyplaza no lleva letra, así que el ícono va justo en el centro del techo.
  // En los demás va a un lado de la letra (a la izquierda cuando a la derecha hay otro edificio).
  const desplazamiento =
    e.clave === 'Ponyplaza' ? '0 0' : lado === 'izquierda' ? '-18 -10' : '18 -10'
  const izquierda = lado === 'izquierda'
  return (
    <g
      className={`lugar lugar-${tipo}`}
      style={{
        transform: `translate(${e.etiqueta[0]}px, ${e.etiqueta[1]}px) scale(calc(1 / var(--k)))`,
      }}
    >
      <g transform={`translate(${desplazamiento})`}>
        <circle r="11.5" className="lugar-fondo" />
        <path d={ICONOS[tipo]} transform="translate(-7.2 -7.2) scale(.6)" className="lugar-icono" />
        <text
          className="lugar-nombre d3"
          x={izquierda ? -15 : 15}
          y="4"
          textAnchor={izquierda ? 'end' : 'start'}
        >
          {nombre}
        </text>
      </g>
    </g>
  )
}

/**
 * @param {{tapadas?: Set<string>}} props ids de edificios cuya letra queda bajo un pin
 */
export function CapaEtiquetas({ tapadas = new Set() }) {
  return (
    <svg className="capa-croquis capa-etiquetas" viewBox={VIEWBOX} aria-hidden="true">
      <defs>
        {CALLES_CON_NOMBRE.map((c, i) => (
          <path key={i} id={`ruta-calle-${i}`} d={aRuta(c.puntos)} />
        ))}
      </defs>

      {/* Nombres de calles a lo largo de su trazo */}
      {CALLES_CON_NOMBRE.map((c, i) => (
        <text key={i} className="etiqueta-calle" dy="0.35em">
          <textPath href={`#ruta-calle-${i}`} startOffset="50%" textAnchor="middle">
            {c.nombre}
          </textPath>
        </text>
      ))}

      {/* Nombres de las unidades (solo con el mapa alejado) */}
      {NOMBRES_UNIDADES.map((u) => (
        <text key={u.texto} className="etiqueta-unidad solo-d1" x={u.x} y={u.y}>
          {u.texto}
        </text>
      ))}

      {/* Nombres secundarios (al acercar) */}
      {ESTACIONAMIENTOS_ROTULADOS.map((e) => {
        const [x, y] = puntoEtiqueta(e.puntos)
        return (
          <text key={e.id} className="etiqueta-secundaria d2" x={x} y={y}>
            {e.nombre}
          </text>
        )
      })}
      {[campus.alberca, ...campus.campos, { ...campus.pista, puntos: campus.pista.interior }].map(
        (z) => {
          const [x, y] = puntoEtiqueta(z.puntos)
          return (
            <text
              key={z.id}
              className="etiqueta-secundaria d2"
              x={x}
              y={z.id === 'campo-pista' ? y - 18 : y}
            >
              {z.nombre}
            </text>
          )
        },
      )}

      {/* Accesos */}
      {campus.accesos.map((a) => (
        <g
          key={a.id}
          className="acceso d2"
          style={{
            transform: `translate(${a.punto[0]}px, ${a.punto[1]}px) scale(calc(1 / var(--k)))`,
          }}
        >
          <path className="acceso-marca" d="M-6 4L0 -6L6 4Z" />
          <text className="acceso-nombre d3" x="9" y="4">
            {a.nombre}
          </text>
        </g>
      ))}

      {/* Letras de los edificios. Si un pin queda encima, la letra lleva un fondo para leerse */}
      {EDIFICIOS.filter((e) => e.clave !== 'Ponyplaza').map((e) => {
        const ancho = 0.62 * e.clave.length + 0.7 // en em, para que crezca con la letra
        return (
          <g
            key={e.id}
            className={`letra n${e.nivel} ${tapadas.has(e.id) ? 'tapada' : ''}`}
            style={{
              transform: `translate(${e.etiqueta[0]}px, ${e.etiqueta[1]}px) scale(calc(1 / var(--k)))`,
            }}
          >
            <rect
              className="letra-fondo"
              x={`${-ancho / 2}em`}
              y="-0.62em"
              width={`${ancho}em`}
              height="1.24em"
              rx="0.4em"
            />
            <text dy="0.36em">{e.clave}</text>
          </g>
        )
      })}

      {campus.lugares.map((l) => (
        <Lugar key={l.nombre} {...l} />
      ))}
    </svg>
  )
}
