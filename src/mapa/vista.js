// Cálculos de la vista del mapa (encuadre inicial y nivel de detalle). Funciones puras.

/**
 * Calcula la escala y posición para que una caja de contenido quepa completa en la pantalla,
 * respetando márgenes (por ejemplo, el espacio que ocupan la barra superior y los botones).
 * @param {{x0:number,y0:number,x1:number,y1:number}} contenido caja en píxeles del contenido
 * @param {{ancho:number,alto:number}} pantalla tamaño del área del mapa
 * @param {{arriba:number,abajo:number,lados:number}} margenes
 * @returns {{escala:number,x:number,y:number}} valores para TransformWrapper
 */
export function encuadrar(contenido, pantalla, margenes) {
  const anchoLibre = pantalla.ancho - margenes.lados * 2
  const altoLibre = pantalla.alto - margenes.arriba - margenes.abajo
  const anchoContenido = contenido.x1 - contenido.x0
  const altoContenido = contenido.y1 - contenido.y0
  const escala = Math.min(anchoLibre / anchoContenido, altoLibre / altoContenido)
  return {
    escala,
    x: margenes.lados + (anchoLibre - anchoContenido * escala) / 2 - contenido.x0 * escala,
    y: margenes.arriba + (altoLibre - altoContenido * escala) / 2 - contenido.y0 * escala,
  }
}

/**
 * Encuadre que "llena" la pantalla: centra la caja de interés y escala lo necesario para que
 * (1) la caja quepa completa y (2) el contenido cubra toda la pantalla, sin franjas vacías.
 * Si cumplir (2) obliga a acercar más, la caja se recorta por los lados que no caben.
 * @param {{x0,y0,x1,y1}} foco caja de interés, en píxeles del contenido
 * @param {{ancho:number,alto:number}} contenido tamaño total del contenido (a escala 1)
 * @param {{ancho:number,alto:number}} pantalla
 */
export function rellenar(foco, contenido, pantalla) {
  const escala = Math.max(
    encuadrar(foco, pantalla, { arriba: 0, abajo: 0, lados: 0 }).escala,
    pantalla.ancho / contenido.ancho,
    pantalla.alto / contenido.alto,
  )
  const cx = (foco.x0 + foco.x1) / 2
  const cy = (foco.y0 + foco.y1) / 2
  // Centra el foco y luego corrige para que no se vea nada fuera del contenido
  const limitar = (valor, minimo) => Math.min(0, Math.max(minimo, valor))
  return {
    escala,
    x: limitar(pantalla.ancho / 2 - cx * escala, pantalla.ancho - contenido.ancho * escala),
    y: limitar(pantalla.alto / 2 - cy * escala, pantalla.alto - contenido.alto * escala),
  }
}

/**
 * Convierte la posición de un toque en pantalla a metros del mapa.
 * @param {{x:number, y:number}} toque posición en pantalla (clientX, clientY)
 * @param {{left:number, top:number, width:number}} rect rectángulo del croquis ya transformado
 * @param {{x:number, y:number, ancho:number}} limites área del dibujo en metros
 */
export function pantallaAMetros(toque, rect, limites) {
  const pxPorMetro = rect.width / limites.ancho
  return [
    limites.x + (toque.x - rect.left) / pxPorMetro,
    limites.y + (toque.y - rect.top) / pxPorMetro,
  ]
}

/** Rectángulo del contenido (en píxeles a escala 1) que se ve en pantalla. */
export function areaVisible({ escala, x, y }, pantalla) {
  return {
    x0: -x / escala,
    y0: -y / escala,
    x1: (pantalla.ancho - x) / escala,
    y1: (pantalla.alto - y) / escala,
  }
}

/**
 * Qué letras de edificio se muestran según los píxeles por metro:
 * 1 = solo edificios grandes, 2 = también medianos, 3 = todos.
 * Con el campus completo en escritorio (≈1.1 px/m) ya se ven todas.
 */
export function nivelLetras(pixelesPorMetro) {
  if (pixelesPorMetro < 0.9) return 1
  if (pixelesPorMetro < 1.05) return 2
  return 3
}

/**
 * Nivel de detalle según cuántos píxeles de pantalla ocupa un metro.
 * 1 = campus completo, 2 = se ven cajones y carriles, 3 = nombres de accesos y lugares.
 */
export function nivelDetalle(pixelesPorMetro) {
  if (pixelesPorMetro < 1.3) return 1
  if (pixelesPorMetro < 2.4) return 2
  return 3
}
