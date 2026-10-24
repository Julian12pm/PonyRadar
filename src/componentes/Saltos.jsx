// Botones para saltar a cada unidad del campus. Muestran cuántos pines de esa unidad
// quedan fuera de la vista actual.

const SALTOS = [
  { id: 'unidad-central', texto: 'Central' },
  { id: 'unidad-metal-mecanica', texto: 'Metal Mecánica' },
  { id: 'unidad-posgrado', texto: 'Posgrado' },
  { id: 'todo', texto: 'Ver todo' },
]

/**
 * @param {{contadores: Record<string, number>, onSaltar: (id: string) => void}} props
 */
export default function Saltos({ contadores = {}, onSaltar }) {
  return (
    <nav className="saltos" aria-label="Ir a una unidad">
      {SALTOS.map((s) => {
        const fuera = contadores[s.id] ?? 0
        return (
          <button key={s.id} className="salto" onClick={() => onSaltar(s.id)}>
            {s.texto}
            {fuera > 0 && (
              <span className="salto-contador" aria-label={`${fuera} pines fuera de la vista`}>
                {fuera}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
