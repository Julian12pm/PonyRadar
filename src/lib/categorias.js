// Categorías de objetos que se pueden reportar.

export const CATEGORIAS = [
  { id: 'electronicos', nombre: 'Electrónicos' },
  { id: 'credenciales', nombre: 'Credenciales y documentos' },
  { id: 'llaves', nombre: 'Llaves' },
  { id: 'ropa', nombre: 'Ropa' },
  { id: 'mochilas', nombre: 'Mochilas y bolsas' },
  { id: 'utiles', nombre: 'Útiles escolares' },
  { id: 'termos', nombre: 'Termos y loncheras' },
  { id: 'otros', nombre: 'Otros' },
]

/** Nombre de una categoría a partir de su id ("llaves" → "Llaves"). */
export function nombreCategoria(id) {
  return CATEGORIAS.find((c) => c.id === id)?.nombre ?? 'Otros'
}
