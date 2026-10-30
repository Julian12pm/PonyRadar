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
    // minmax(0, 1fr): la columna nunca es más ancha que la pantalla, aunque algo no quepa
    <main className="grid min-h-full grid-cols-[minmax(0,1fr)] place-items-center bg-fondo px-4 py-8">
      <div className="tarjeta w-full max-w-sm px-5 pt-5 pb-6">
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl font-extrabold [overflow-wrap:normal]">
          <img src="/favicon.svg" alt="" className="size-11 shrink-0" />
          PonyRadar
        </h1>
        <p className="mt-1 text-tinta/75">
          Objetos perdidos y encontrados del Tec de Morelia, sobre el mapa del campus.
        </p>

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
    </main>
  )
}
