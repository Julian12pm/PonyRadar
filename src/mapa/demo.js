// Pines de prueba en memoria (Fase 1). En la Fase 2 se reemplazan por los pines de Supabase.

import { EDIFICIOS } from './campus.js'
import { caja } from './geometria.js'
import { detectarZona } from './deteccion.js'

/** Punto frente a la cara sur de un edificio (donde suele estar la entrada). */
function frenteA(clave, dx = 0, dy = 6) {
  const e = EDIFICIOS.find((x) => x.clave === clave)
  const { x0, x1, y1 } = caja(e.puntos)
  return [(x0 + x1) / 2 + dx, y1 + dy]
}

const horasAtras = (h) => new Date(Date.now() - h * 3600_000).toISOString()

const BASE = [
  {
    id: 'demo-01',
    tipo: 'rojo',
    categoria: 'electronicos',
    titulo: 'Calculadora Casio gris',
    punto: frenteA('CH'),
    horas: 3,
  },
  {
    id: 'demo-02',
    tipo: 'rojo',
    categoria: 'credenciales',
    titulo: 'Credencial del Tec',
    punto: frenteA('E', -6),
    horas: 20,
  },
  {
    id: 'demo-03',
    tipo: 'verde',
    categoria: 'termos',
    titulo: 'Termo azul',
    punto: frenteA('R', 4),
    horas: 1,
  },
  {
    id: 'demo-04',
    tipo: 'verde',
    categoria: 'llaves',
    titulo: 'Llavero con 3 llaves',
    punto: frenteA('Q', 8, 10),
    horas: 30,
  },
  {
    id: 'demo-05',
    tipo: 'rojo',
    categoria: 'mochilas',
    titulo: 'Mochila negra',
    punto: frenteA('J'),
    horas: 8,
  },
  {
    id: 'demo-06',
    tipo: 'verde',
    categoria: 'ropa',
    titulo: 'Sudadera gris',
    punto: frenteA('AH', 30, 14),
    horas: 50,
  },
  {
    id: 'demo-07',
    tipo: 'rojo',
    categoria: 'utiles',
    titulo: 'Cuaderno de cálculo',
    punto: frenteA('2D'),
    horas: 5,
  },
  // Tres pines muy juntos frente al gimnasio: al alejar se agrupan
  {
    id: 'demo-08',
    tipo: 'rojo',
    categoria: 'electronicos',
    titulo: 'Audífonos blancos',
    punto: frenteA('U', -6, 8),
    horas: 2,
  },
  {
    id: 'demo-09',
    tipo: 'verde',
    categoria: 'otros',
    titulo: 'Paraguas',
    punto: frenteA('U', 2, 10),
    horas: 4,
  },
  {
    id: 'demo-10',
    tipo: 'verde',
    categoria: 'credenciales',
    titulo: 'INE',
    punto: frenteA('U', 8, 7),
    horas: 12,
  },
  {
    id: 'demo-11',
    tipo: 'rojo',
    categoria: 'llaves',
    titulo: 'Llave de casillero',
    punto: frenteA('3A', 0, 8),
    horas: 26,
  },
]

/** Pines de prueba con su zona ya detectada. */
export const PINES_DEMO = BASE.map(({ horas, ...p }) => {
  const zona = detectarZona(p.punto)
  return { ...p, zonaId: zona?.id ?? null, creado: horasAtras(horas) }
})

// Punto seguro principal: el Centro de Información (AF), con su contador de objetos en resguardo
export const SEGUROS_DEMO = [
  { id: 's1', nombre: 'Biblioteca (AF)', cantidad: 3, punto: frenteA('AF', 0, 7) },
]
