import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const sesion = vi.hoisted(() => ({
  enviarCodigo: vi.fn(async () => 'enviado'),
  verificarCodigo: vi.fn(async () => {}),
}))
vi.mock('../lib/sesion.js', () => sesion)

const { default: Login } = await import('./Login.jsx')

describe('Login', () => {
  it('no pide código para un correo que no es institucional', () => {
    render(<Login />)
    fireEvent.change(screen.getByLabelText('Correo institucional'), {
      target: { value: 'alguien@gmail.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme un código' }))
    expect(screen.getByRole('alert')).toHaveTextContent('@morelia.tecnm.mx')
    expect(sesion.enviarCodigo).not.toHaveBeenCalled()
  })

  it('pide el código y luego entra con los 6 dígitos', async () => {
    render(<Login />)
    fireEvent.change(screen.getByLabelText('Correo institucional'), {
      target: { value: 'l21120001@morelia.tecnm.mx' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme un código' }))
    expect(sesion.enviarCodigo).toHaveBeenCalledWith('l21120001@morelia.tecnm.mx')

    const campo = await screen.findByLabelText('Código')
    const entrar = screen.getByRole('button', { name: 'Entrar' })
    expect(entrar).toBeDisabled()
    // Solo acepta dígitos
    fireEvent.change(campo, { target: { value: '12a34b56' } })
    expect(campo).toHaveValue('123456')
    fireEvent.click(entrar)
    expect(sesion.verificarCodigo).toHaveBeenCalledWith('l21120001@morelia.tecnm.mx', '123456')
  })

  it('si el servidor tarda (504), pasa al código y avisa que puede tardar en llegar', async () => {
    sesion.enviarCodigo.mockResolvedValueOnce('lento')
    render(<Login />)
    fireEvent.change(screen.getByLabelText('Correo institucional'), {
      target: { value: 'l21120001@morelia.tecnm.mx' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme un código' }))
    expect(await screen.findByLabelText('Código')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      /Te enviamos un código.*Puede tardar un minuto en llegar/,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('"Ya tengo un código" va directo a escribirlo sin pedir otro', async () => {
    sesion.enviarCodigo.mockClear()
    render(<Login />)
    // Sin correo válido no puede pasar: hace falta para verificar el código
    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo un código' }))
    expect(screen.getByRole('alert')).toHaveTextContent('@morelia.tecnm.mx')

    fireEvent.change(screen.getByLabelText('Correo institucional'), {
      target: { value: 'l23121115+admin@morelia.tecnm.mx' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo un código' }))
    fireEvent.change(await screen.findByLabelText('Código'), { target: { value: '654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(sesion.enviarCodigo).not.toHaveBeenCalled()
    expect(sesion.verificarCodigo).toHaveBeenCalledWith(
      'l23121115+admin@morelia.tecnm.mx',
      '654321',
    )
  })

  it('muestra el error si el código no es válido', async () => {
    sesion.verificarCodigo.mockRejectedValueOnce(new Error('El código no es válido o ya expiró.'))
    render(<Login />)
    fireEvent.change(screen.getByLabelText('Correo institucional'), {
      target: { value: 'l21120001@morelia.tecnm.mx' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme un código' }))
    fireEvent.change(await screen.findByLabelText('Código'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ya expiró')
  })
})
