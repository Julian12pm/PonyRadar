import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { zonaPorId } from '../mapa/zonas.js'
import Filtros from './Filtros.jsx'
import HojaLugar from './HojaLugar.jsx'
import Saltos from './Saltos.jsx'

describe('Filtros', () => {
  it('cambia el tipo de pin', () => {
    const onCambiar = vi.fn()
    render(<Filtros filtro={{ tipo: 'todos', categoria: null }} onCambiar={onCambiar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Perdidos' }))
    expect(onCambiar).toHaveBeenCalledWith({ tipo: 'rojo', categoria: null })
  })

  it('elige una categoría desde el menú', () => {
    const onCambiar = vi.fn()
    render(<Filtros filtro={{ tipo: 'verde', categoria: null }} onCambiar={onCambiar} />)
    fireEvent.click(screen.getByRole('button', { name: /Categoría/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Llaves' }))
    expect(onCambiar).toHaveBeenCalledWith({ tipo: 'verde', categoria: 'llaves' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('HojaLugar', () => {
  it('avisa cuando el toque cae fuera del campus', () => {
    render(<HojaLugar zona={null} onPublicar={vi.fn()} onCerrar={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Fuera del campus' })).toBeInTheDocument()
  })

  it('muestra el edificio y publica un pin rojo con piso y categoría', () => {
    const onPublicar = vi.fn()
    render(<HojaLugar zona={zonaPorId('edificio-K')} onPublicar={onPublicar} onCerrar={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Edificio K' })).toBeInTheDocument()
    expect(screen.getByText(/Aulas y Delegación Sindical/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Perdí algo aquí' }))
    const publicar = screen.getByRole('button', { name: /Publicar pin rojo/ })
    expect(publicar).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Piso o salón (opcional)'), {
      target: { value: 'K-12' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'llaves' } })
    fireEvent.change(screen.getByLabelText('¿Qué perdiste?'), { target: { value: '  Llaves  ' } })
    expect(publicar).toBeEnabled()
    fireEvent.click(publicar)

    expect(onPublicar).toHaveBeenCalledWith({
      tipo: 'rojo',
      categoria: 'llaves',
      titulo: 'Llaves',
      descripcion: '',
      piso: 'K-12',
    })
  })

  it('en un exterior no pregunta piso y respeta el tipo ya elegido', () => {
    render(
      <HojaLugar
        zona={zonaPorId('alberca')}
        tipoInicial="verde"
        onPublicar={vi.fn()}
        onCerrar={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText('Piso o salón (opcional)')).not.toBeInTheDocument()
    expect(screen.getByLabelText('¿Qué encontraste?')).toBeInTheDocument()
  })

  it('se cierra con Escape', () => {
    const onCerrar = vi.fn()
    render(<HojaLugar zona={zonaPorId('alberca')} onPublicar={vi.fn()} onCerrar={onCerrar} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCerrar).toHaveBeenCalled()
  })
})

describe('Saltos', () => {
  it('muestra el contador de pines fuera de la vista y salta al tocar', () => {
    const onSaltar = vi.fn()
    render(<Saltos contadores={{ 'unidad-posgrado': 2 }} onSaltar={onSaltar} />)
    expect(screen.getByLabelText('2 pines fuera de la vista')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Metal Mecánica/ }))
    expect(onSaltar).toHaveBeenCalledWith('unidad-metal-mecanica')
  })
})
