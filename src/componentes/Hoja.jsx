// Hoja que sube desde abajo de la pantalla (para el lugar tocado, un pin, un punto seguro…).
import { useEffect } from 'react'

/**
 * @param {{titulo: string, subtitulo?: string, onCerrar: () => void, children: React.ReactNode}} props
 */
export default function Hoja({ titulo, subtitulo, onCerrar, children }) {
  // Escape cierra la hoja
  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  return (
    <section className="hoja" role="dialog" aria-label={titulo}>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-tight font-extrabold">{titulo}</h2>
          {subtitulo && <p className="text-sm leading-snug text-tinta/70">{subtitulo}</p>}
        </div>
        <button type="button" className="hoja-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      <div className="mt-3">{children}</div>
    </section>
  )
}
