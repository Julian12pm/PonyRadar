// Fotos de los pines. Todo se procesa en el navegador antes de subir:
//   · se reduce a un tamaño razonable y se convierte a WebP;
//   · en pines verdes se genera además una versión MUY desenfocada, que es la única pública.

/** Recomendaciones antes de fotografiar un objeto encontrado (pin verde), por categoría. */
export const GUIAS_FOTO = {
  electronicos: 'Tómala de lejos: sin modelo, calcomanías, nombre ni funda.',
  credenciales: 'Mejor no subas foto: el nombre, la foto y el número son el dato ciego.',
  llaves: 'Solo la forma general; sin mostrar llaveros o adornos que las identifiquen.',
  ropa: 'Doblada, sin mostrar estampados, marcas ni etiquetas.',
  mochilas: 'Cerrada y sin mostrar lo que tiene dentro.',
  utiles: 'Cerrado, sin portada, nombre ni notas visibles.',
  termos: 'Sin calcomanías, nombre ni detalles únicos.',
  otros: 'Sin detalles que lo identifiquen: esos van en el dato ciego.',
}

export const LADO_MAXIMO = 1280 // px de la foto nítida
const LADO_DESENFOCADA = 28 // px: se reduce muchísimo y luego se agranda borrosa

/** Medidas para que el lado mayor no pase de `maximo`, sin deformar la foto. */
export function medidasReducidas(ancho, alto, maximo) {
  const escala = Math.min(1, maximo / Math.max(ancho, alto))
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }
}

function lienzoABlob(lienzo, calidad) {
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo procesar la foto'))),
      'image/webp',
      calidad,
    ),
  )
}

/**
 * Prepara las fotos de un pin a partir del archivo elegido.
 * @param {File} archivo
 * @param {'rojo'|'verde'} tipo
 * @returns {Promise<{publica: Blob, nitida?: Blob}>} en rojo la pública es la nítida;
 *   en verde la pública va desenfocada y la nítida queda privada
 */
export async function prepararFotos(archivo, tipo) {
  const imagen = await createImageBitmap(archivo)
  const { ancho, alto } = medidasReducidas(imagen.width, imagen.height, LADO_MAXIMO)

  const nitido = document.createElement('canvas')
  nitido.width = ancho
  nitido.height = alto
  nitido.getContext('2d').drawImage(imagen, 0, 0, ancho, alto)
  const nitida = await lienzoABlob(nitido, 0.82)
  if (tipo === 'rojo') return { publica: nitida }

  // Desenfoque: se dibuja diminuta y se vuelve a agrandar con desenfoque encima.
  // Así no queda información recuperable de los detalles.
  const chica = medidasReducidas(ancho, alto, LADO_DESENFOCADA)
  const mini = document.createElement('canvas')
  mini.width = chica.ancho
  mini.height = chica.alto
  mini.getContext('2d').drawImage(imagen, 0, 0, chica.ancho, chica.alto)

  const grande = medidasReducidas(ancho, alto, 480)
  const borroso = document.createElement('canvas')
  borroso.width = grande.ancho
  borroso.height = grande.alto
  const ctx = borroso.getContext('2d')
  ctx.filter = 'blur(14px)'
  // Se dibuja un poco más grande que el lienzo para que las orillas no queden transparentes
  ctx.drawImage(mini, -20, -20, grande.ancho + 40, grande.alto + 40)
  const publica = await lienzoABlob(borroso, 0.6)

  return { publica, nitida }
}
