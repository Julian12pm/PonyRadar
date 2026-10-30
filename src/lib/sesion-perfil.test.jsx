import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Supabase simulado: hay sesión guardada, pero la consulta del perfil falla por red
const supabase = vi.hoisted(() => ({
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'yo' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } }),
      }),
    }),
  }),
}))
vi.mock('./supabase.js', () => ({ supabase, configurado: true }))

const { useSesion } = await import('./sesion.js')

describe('useSesion sin conexión', () => {
  it('usa la última copia local del perfil si el servidor no responde', async () => {
    const perfil = { id: 'yo', nombre: 'Ana', rol: 'comunidad', bloqueado: false }
    localStorage.setItem('ponyradar:perfil:yo', JSON.stringify({ guardado: '', valor: perfil }))
    const { result } = renderHook(() => useSesion())
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.perfil).toEqual(perfil)
  })

  it('sin copia local, el perfil queda vacío (la app no lo toma como suspensión)', async () => {
    localStorage.clear()
    const { result } = renderHook(() => useSesion())
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.perfil).toBeNull()
  })
})
