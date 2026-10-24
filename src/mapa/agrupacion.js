// Agrupación de pines: al alejar el mapa, los pines que quedarían encimados en pantalla
// se juntan en una burbuja con el número de pines.

export const RADIO_GRUPO_PX = 30

/**
 * Zoom (px por metro) necesario para que los pines de un grupo se vean separados:
 * la distancia más corta entre dos de ellos debe medir más que el radio de agrupación.
 */
export function escalaParaSeparar(pines, radioPx = RADIO_GRUPO_PX) {
  let minima = Infinity
  for (let i = 0; i < pines.length; i++) {
    for (let j = i + 1; j < pines.length; j++) {
      const [a, b] = [pines[i].punto, pines[j].punto]
      minima = Math.min(minima, Math.hypot(a[0] - b[0], a[1] - b[1]))
    }
  }
  return minima === 0 ? Infinity : (radioPx * 1.15) / minima
}

/**
 * @param {{id:string, punto:[number, number]}[]} pines posiciones en metros
 * @param {number} k píxeles de pantalla por metro (zoom actual)
 * @param {number} radioPx distancia en pantalla por debajo de la cual dos pines se juntan
 * @returns {{id:string, punto:[number, number], pines:object[]}[]} grupos; un grupo con un solo
 *   pin se dibuja como pin normal
 */
export function agrupar(pines, k, radioPx = RADIO_GRUPO_PX) {
  const grupos = []
  // Orden fijo (por id) para que los grupos no "brinquen" entre un render y otro
  const ordenados = [...pines].sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const pin of ordenados) {
    const cercano = grupos.find(
      (g) => Math.hypot(g.punto[0] - pin.punto[0], g.punto[1] - pin.punto[1]) * k < radioPx,
    )
    if (cercano) {
      cercano.pines.push(pin)
      // El grupo se ubica en el promedio de sus pines
      const n = cercano.pines.length
      cercano.punto = [
        cercano.pines.reduce((s, p) => s + p.punto[0], 0) / n,
        cercano.pines.reduce((s, p) => s + p.punto[1], 0) / n,
      ]
    } else {
      grupos.push({ id: `grupo-${pin.id}`, punto: pin.punto, pines: [pin] })
    }
  }
  return grupos
}
