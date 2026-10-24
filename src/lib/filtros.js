// Filtros del mapa: por tipo de pin (perdidos / encontrados) y por categoría.

/**
 * @param {{tipo:'rojo'|'verde', categoria:string}[]} pines
 * @param {{tipo:'todos'|'rojo'|'verde', categoria:string|null}} filtro
 */
export function filtrarPines(pines, { tipo = 'todos', categoria = null } = {}) {
  return pines.filter(
    (p) => (tipo === 'todos' || p.tipo === tipo) && (!categoria || p.categoria === categoria),
  )
}
