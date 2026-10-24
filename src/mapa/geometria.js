// Funciones de geometría para dibujar el croquis. Todas son puras: reciben puntos [x, y] en metros
// y regresan números o textos, así que se pueden probar sin navegador.

/** Convierte una lista de puntos al formato del atributo `points` de SVG. */
export function aPuntosSvg(puntos, dx = 0, dy = 0) {
  return puntos.map(([x, y]) => `${redondear(x + dx)},${redondear(y + dy)}`).join(' ')
}

/** Convierte una línea (lista de puntos) a un atributo `d` de <path>. */
export function aRuta(puntos, cerrar = false) {
  const d = puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${redondear(x)} ${redondear(y)}`)
  return d.join('') + (cerrar ? 'Z' : '')
}

function redondear(n) {
  return Math.round(n * 10) / 10
}

/** Indica si un punto está dentro de un polígono (regla par-impar). */
export function dentro([x, y], poligono) {
  let adentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i]
    const [xj, yj] = poligono[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro
  }
  return adentro
}

/** Caja que contiene a todos los puntos. */
export function caja(puntos) {
  const xs = puntos.map((p) => p[0])
  const ys = puntos.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** Área de un polígono (siempre positiva). */
export function area(puntos) {
  let suma = 0
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    suma += (puntos[j][0] + puntos[i][0]) * (puntos[j][1] - puntos[i][1])
  }
  return Math.abs(suma / 2)
}

/** Distancia de un punto al borde más cercano del polígono. */
function distanciaAlBorde([px, py], poligono) {
  let minima = Infinity
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [ax, ay] = poligono[j]
    const [bx, by] = poligono[i]
    const dx = bx - ax
    const dy = by - ay
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
    minima = Math.min(minima, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
  }
  return minima
}

/**
 * Mejor punto para poner una etiqueta: el punto interior más alejado de los bordes.
 * Sirve para edificios en forma de U o de H, donde el centro geométrico queda afuera.
 */
export function puntoEtiqueta(puntos) {
  const { x0, y0, x1, y1 } = caja(puntos)
  let mejor = [(x0 + x1) / 2, (y0 + y1) / 2]
  let mejorDistancia = -1
  const pasos = 16
  for (let i = 0; i <= pasos; i++) {
    for (let j = 0; j <= pasos; j++) {
      const p = [x0 + ((x1 - x0) * i) / pasos, y0 + ((y1 - y0) * j) / pasos]
      if (!dentro(p, puntos)) continue
      const d = distanciaAlBorde(p, puntos)
      if (d > mejorDistancia) {
        mejorDistancia = d
        mejor = p
      }
    }
  }
  return mejor
}

/**
 * Rectángulo girado que envuelve al polígono, alineado con su lado más largo.
 * Se usa para dibujar líneas de canchas, carriles y cajones de estacionamiento.
 * @returns {{cx:number, cy:number, largo:number, ancho:number, angulo:number}} ángulo en grados
 */
export function rectanguloOrientado(puntos) {
  // Dirección del lado más largo
  let angulo = 0
  let maximo = -1
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const dx = puntos[i][0] - puntos[j][0]
    const dy = puntos[i][1] - puntos[j][1]
    const largo = Math.hypot(dx, dy)
    if (largo > maximo) {
      maximo = largo
      angulo = Math.atan2(dy, dx)
    }
  }
  // Proyecta los puntos sobre los ejes girados para medir largo y ancho
  const cos = Math.cos(angulo)
  const sin = Math.sin(angulo)
  const us = puntos.map(([x, y]) => x * cos + y * sin)
  const vs = puntos.map(([x, y]) => -x * sin + y * cos)
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)]
  const uc = (u0 + u1) / 2
  const vc = (v0 + v1) / 2
  let largo = u1 - u0
  let ancho = v1 - v0
  let grados = (angulo * 180) / Math.PI
  if (ancho > largo) {
    ;[largo, ancho] = [ancho, largo]
    grados += 90
  }
  return { cx: uc * cos - vc * sin, cy: uc * sin + vc * cos, largo, ancho, angulo: grados }
}

/**
 * Muros de un edificio en volumen: un cuadrilátero por cada lado, del suelo a la altura del techo.
 * El techo se dibuja desplazado `alto` metros hacia arriba (vista oblicua desde el sur).
 * `luz` va de 0 (muro a la sombra) a 1 (muro que ve al sur, más iluminado).
 */
export function muros(puntos, alto) {
  return puntos.map((a, i) => {
    const b = puntos[(i + 1) % puntos.length]
    // Normal del lado: qué tanto "mira" hacia el sur (y positiva) o hacia los lados
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const largo = Math.hypot(dx, dy) || 1
    const haciaSur = Math.abs(dx / largo)
    return {
      puntos: [a, b, [b[0], b[1] - alto], [a[0], a[1] - alto]],
      luz: haciaSur,
    }
  })
}
