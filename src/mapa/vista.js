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
 * Nivel de detalle según cuántos píxeles de pantalla ocupa un metro.
 * 1 = campus completo, 2 = se ven cajones y carriles, 3 = nombres de accesos y lugares.
 */
export function nivelDetalle(pixelesPorMetro) {
  if (pixelesPorMetro < 1.3) return 1
  if (pixelesPorMetro < 2.4) return 2
  return 3
}
