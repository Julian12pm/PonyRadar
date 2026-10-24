// Detecta qué letras de edificio quedan debajo de un pin, para dibujarlas con fondo y que se lean.
// Los pines y las letras miden siempre lo mismo en pantalla (en px), pero sus posiciones están en
// metros; por eso todo se compara en píxeles usando k = píxeles por metro.

// Medidas en píxeles de pantalla (ver Alfiler en MapaCampus.jsx)
export const CABEZA_ALFILER = { sobreElPunto: 29, radio: 13 }
const TAMANO_LETRA = 14

/** Medio ancho y medio alto (px) de la etiqueta de una letra como "CH" o "2D". */
function medidasLetra(texto) {
  const ancho = (0.62 * texto.length + 0.7) * TAMANO_LETRA
  return { medioAncho: ancho / 2, medioAlto: 0.62 * TAMANO_LETRA }
}

/** ¿Un círculo (centro y radio en px) toca un rectángulo centrado en el origen? */
function circuloTocaRectangulo(cx, cy, radio, medioAncho, medioAlto) {
  const x = Math.max(-medioAncho, Math.min(medioAncho, cx))
  const y = Math.max(-medioAlto, Math.min(medioAlto, cy))
  return Math.hypot(cx - x, cy - y) < radio
}

/**
 * @param {{id:string, punto:number[], texto:string}[]} letras posición de cada letra (metros)
 * @param {{punto:number[], forma:'alfiler'|'circulo', radio?:number}[]} marcadores
 *   alfiler: la cabeza queda arriba del punto; circulo: centrado en el punto (burbujas, puntos seguros)
 * @param {number} k píxeles de pantalla por metro
 * @returns {Set<string>} ids de las letras tapadas
 */
export function letrasTapadas(letras, marcadores, k) {
  const tapadas = new Set()
  for (const letra of letras) {
    const { medioAncho, medioAlto } = medidasLetra(letra.texto)
    for (const m of marcadores) {
      // Centro del marcador relativo a la letra, en píxeles
      let cx = (m.punto[0] - letra.punto[0]) * k
      let cy = (m.punto[1] - letra.punto[1]) * k
      let radio = m.radio ?? 20
      if (m.forma === 'alfiler') {
        cy -= CABEZA_ALFILER.sobreElPunto
        radio = CABEZA_ALFILER.radio
      }
      if (circuloTocaRectangulo(cx, cy, radio, medioAncho, medioAlto)) {
        tapadas.add(letra.id)
        break
      }
    }
  }
  return tapadas
}
