// Inicio de sesión en dos pasos: correo institucional → código de 6 dígitos que llega por correo.
// Si el servidor tarda en mandar el correo (504), se pasa igual a escribir el código: casi
// siempre sí llega. "Ya tengo un código" lleva directo a escribirlo sin pedir otro.
import { useState } from 'react'
import { esCorreoInstitucional } from '../lib/correo.js'
import { enviarCodigo, verificarCodigo } from '../lib/sesion.js'

export default function Login() {
  const [paso, setPaso] = useState('correo') // 'correo' | 'codigo'
  const [correo, setCorreo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  // Texto arriba del campo del código: 'enviado' | 'lento' | 'ya-tengo'
  const [envio, setEnvio] = useState('enviado')

  const correoValido = esCorreoInstitucional(correo)

  const pedirCodigo = async (e) => {
    e.preventDefault()
    setError('')
    if (!correoValido) {
      setError('Usa tu correo institucional @morelia.tecnm.mx')
      return
    }
    setOcupado(true)
    try {
      setEnvio(await enviarCodigo(correo))
      setPaso('codigo')
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const yaTengoCodigo = () => {
    setError('')
    if (!correoValido) {
      setError('Escribe primero tu correo institucional @morelia.tecnm.mx')
      return
    }
    setEnvio('ya-tengo')
    setPaso('codigo')
  }

  const entrar = async (e) => {
    e.preventDefault()
    setError('')
    setOcupado(true)
    try {
      await verificarCodigo(correo, codigo)
      // Al verificar, la sesión cambia y App muestra el mapa
    } catch (err) {
      setError(err.message)
      setOcupado(false)
    }
  }

  return (
    <main className="min-h-full bg-fondo px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <section className="mx-auto w-full max-w-xl lg:mx-0" aria-labelledby="bienvenida-titulo">
          <a href="/" className="inline-flex items-center gap-2 text-lg font-extrabold">
            <img src="/favicon.svg" alt="" className="size-10" />
            PonyRadar
          </a>
          <p className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-tinta/10 bg-white/70 px-3 py-1 text-sm font-bold">
            <span className="size-2.5 rounded-full bg-pin-verde" aria-hidden="true" />
            Comunidad del Tec de Morelia
          </p>
          <h1 id="bienvenida-titulo" className="mt-4 text-4xl leading-[1.05] font-extrabold sm:text-5xl">
            Lo perdiste.<br />
            <span className="text-pin-verde">La comunidad</span> puede encontrarlo.
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-tinta/75">
            Publica un aviso en el mapa del campus y conecta con quien encontró tu objeto. Si ves algo perdido, ayuda a que vuelva a su dueño.
          </p>

          <div className="mt-7 grid max-w-lg grid-cols-2 gap-3" aria-label="Cómo puedes ayudar">
            <div className="rounded-2xl border-2 border-tinta bg-white p-4 shadow-[0_4px_0_#2b3a4a22]">
              <span className="grid size-10 place-items-center rounded-xl bg-pin-rojo/12 text-xl" aria-hidden="true">●</span>
              <h2 className="mt-3 font-extrabold">¿Perdiste algo?</h2>
              <p className="mt-1 text-sm text-tinta/70">Marca el lugar y describe tu objeto.</p>
            </div>
            <div className="rounded-2xl border-2 border-tinta bg-white p-4 shadow-[0_4px_0_#2b3a4a22]">
              <span className="grid size-10 place-items-center rounded-xl bg-pin-verde/15 text-xl" aria-hidden="true">●</span>
              <h2 className="mt-3 font-extrabold">¿Encontraste algo?</h2>
              <p className="mt-1 text-sm text-tinta/70">Avísale a su dueño con seguridad.</p>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#dce5d7] p-4 text-sm">
            <span className="text-lg" aria-hidden="true">●</span>
            <p><strong>Entrega segura:</strong> los datos de verificación protegen cada reclamo y puedes coordinar la entrega en un punto seguro.</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md" aria-labelledby="acceso-titulo">
          <div className="tarjeta px-5 pt-5 pb-6 sm:px-7 sm:pt-7">
            <h2 id="acceso-titulo" className="text-2xl font-extrabold">Encuentra el camino de vuelta</h2>
            <p className="mt-1 text-tinta/75">Inicia sesión con tu correo institucional para entrar al mapa.</p>

        {paso === 'correo' ? (
          <form className="mt-5 grid gap-3" onSubmit={pedirCodigo} noValidate>
            <label className="campo">
              <span>Correo institucional</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="l21120001@morelia.tecnm.mx"
                aria-invalid={Boolean(error)}
                required
              />
            </label>
            <button type="submit" className="boton boton-verde" disabled={ocupado}>
              {ocupado ? 'Enviando…' : 'Enviarme un código'}
            </button>
            <button
              type="button"
              className="text-sm font-semibold underline"
              disabled={ocupado}
              onClick={yaTengoCodigo}
            >
              Ya tengo un código
            </button>
          </form>
        ) : (
          <form className="mt-5 grid gap-3" onSubmit={entrar}>
            <p className="text-sm" role="status">
              {envio === 'ya-tengo'
                ? 'Escribe el código de 6 dígitos que te llegó a '
                : 'Te enviamos un código de 6 dígitos a '}
              <strong className="break-all">{correo.trim().toLowerCase()}</strong>.
              {envio === 'lento' &&
                ' Puede tardar un minuto en llegar; revisa también la carpeta de correo no deseado.'}
            </p>
            <label className="campo">
              <span>Código</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-[0.4em]"
                required
              />
            </label>
            <button
              type="submit"
              className="boton boton-verde"
              disabled={ocupado || codigo.length !== 6}
            >
              {ocupado ? 'Entrando…' : 'Entrar'}
            </button>
            <button
              type="button"
              className="text-sm font-semibold underline"
              onClick={() => {
                setPaso('correo')
                setCodigo('')
                setError('')
              }}
            >
              Usar otro correo o pedir otro código
            </button>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-pin-rojo/12 px-3 pt-2 pb-1.5 text-sm font-semibold"
          >
            {error}
          </p>
        )}
      </div>
          </div>
          <p className="mt-4 text-center text-xs text-tinta/60">PonyRadar · Objetos perdidos y encontrados del campus</p>
        </section>
      </div>
    </main>
  )
}
