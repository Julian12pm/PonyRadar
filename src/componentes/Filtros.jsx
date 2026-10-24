// Filtros del mapa: tipo de pin (chips) y categoría (menú desplegable).
import { useState } from 'react'
import { CATEGORIAS, nombreCategoria } from '../lib/categorias.js'

const TIPOS = [
  { id: 'todos', texto: 'Todo' },
  { id: 'rojo', texto: 'Perdidos' },
  { id: 'verde', texto: 'Encontrados' },
]

/**
 * @param {{filtro: {tipo: string, categoria: string|null}, onCambiar: (filtro) => void}} props
 */
export default function Filtros({ filtro, onCambiar }) {
  const [menuAbierto, setMenuAbierto] = useState(false)

  const elegirCategoria = (categoria) => {
    onCambiar({ ...filtro, categoria })
    setMenuAbierto(false)
  }

  return (
    <div className="relative mt-1.5">
      <div className="chips flex gap-1.5 overflow-x-auto" role="group" aria-label="Filtrar pines">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${filtro.tipo === t.id ? 'chip-activo' : ''}`}
            aria-pressed={filtro.tipo === t.id}
            onClick={() => onCambiar({ ...filtro, tipo: t.id })}
          >
            {t.texto}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${filtro.categoria ? 'chip-activo' : ''}`}
          aria-expanded={menuAbierto}
          aria-haspopup="menu"
          onClick={() => setMenuAbierto(!menuAbierto)}
        >
          {filtro.categoria ? nombreCategoria(filtro.categoria) : 'Categoría'} ▾
        </button>
      </div>

      {menuAbierto && (
        <ul className="menu-categorias" role="menu" aria-label="Categorías">
          <li>
            <button type="button" role="menuitem" onClick={() => elegirCategoria(null)}>
              Todas las categorías
            </button>
          </li>
          {CATEGORIAS.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="menuitem"
                className={filtro.categoria === c.id ? 'font-extrabold' : ''}
                onClick={() => elegirCategoria(c.id)}
              >
                {c.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
