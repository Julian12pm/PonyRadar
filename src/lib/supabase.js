// Cliente de Supabase. La URL y la llave publicable vienen de .env.local (ver .env.example).
// La llave publicable puede estar en el navegador: lo que protege los datos es RLS.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const llave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** false si faltan las variables de entorno (la app muestra cómo configurarlas). */
export const configurado = Boolean(url && llave)

export const supabase = configurado ? createClient(url, llave) : null
