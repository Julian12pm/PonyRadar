// Pantalla provisional de la Fase 0. En la Fase 1 se reemplaza por el mapa del campus.
export default function App() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <img src="/favicon.svg" alt="" className="size-16" />
      <h1 className="text-3xl font-extrabold tracking-tight">
        Pony<span className="text-acento">Radar</span>
      </h1>
      <p className="max-w-xs text-neutral-400">
        Objetos perdidos y encontrados del Tec de Morelia. Muy pronto, sobre el mapa del campus.
      </p>
      <div className="flex gap-3 text-sm">
        <span className="rounded-full bg-pin-rojo/15 px-3 py-1 text-pin-rojo">Perdí algo</span>
        <span className="rounded-full bg-pin-verde/15 px-3 py-1 text-pin-verde">Encontré algo</span>
      </div>
    </main>
  )
}
