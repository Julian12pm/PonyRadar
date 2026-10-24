import { describe, it, expect } from 'vitest'
import { campus, EDIFICIOS } from './campus.js'
import { detectarZona, unidadDePunto } from './deteccion.js'
import { LEYENDA } from './leyenda.js'
import { JARDINES, ZONAS, nombreCorto, zonaPorId } from './zonas.js'
import { caja, puntoEtiqueta } from './geometria.js'

const edificio = (clave) => EDIFICIOS.find((e) => e.clave === clave)

describe('zonas', () => {
  it('incluye los 52 edificios de la leyenda oficial con su id', () => {
    for (const clave of Object.keys(LEYENDA)) {
      expect(zonaPorId(`edificio-${clave}`), clave).not.toBeNull()
    }
  })

  it('tiene los 5 estacionamientos numerados y los exteriores pedidos', () => {
    for (const id of [
      'estacionamiento-1',
      'estacionamiento-2',
      'estacionamiento-3',
      'estacionamiento-4',
      'estacionamiento-5',
      'alberca',
      'pista',
      'campo-pista',
      'campo-futbol-ah',
      'cancha-ptar',
      'cancha-basquet-1',
    ]) {
      expect(zonaPorId(id), id).not.toBeNull()
    }
  })

  it('el Estacionamiento 2 junta sus dos polígonos en una sola zona', () => {
    expect(zonaPorId('estacionamiento-2').poligonos).toHaveLength(2)
  })

  it('no hay ids repetidos y la explanada no existe', () => {
    const ids = ZONAS.map((z) => z.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(zonaPorId('explanada')).toBeNull()
  })

  it('cada unidad tiene su jardín', () => {
    expect(JARDINES.map((j) => j.id).sort()).toEqual([
      'jardin-unidad-central',
      'jardin-unidad-metal-mecanica',
      'jardin-unidad-posgrado',
    ])
  })

  it('arma nombres cortos para mostrar', () => {
    expect(nombreCorto(zonaPorId('edificio-K'))).toBe('Edificio K')
    expect(nombreCorto(zonaPorId('estacionamiento-5'))).toBe('Estacionamiento 5')
    expect(nombreCorto(null)).toBe('Fuera del campus')
  })
})

describe('detectarZona', () => {
  it('reconoce cada edificio al tocar su letra (sobre el techo)', () => {
    for (const e of EDIFICIOS) {
      expect(detectarZona(e.etiqueta)?.id, e.clave).toBe(e.id)
    }
  })

  it('reconoce el edificio al tocar su base', () => {
    for (const clave of ['A', 'K', 'U', 'AF', '2A', '3B']) {
      const e = edificio(clave)
      expect(detectarZona(puntoEtiqueta(e.puntos))?.id).toBe(e.id)
    }
  })

  it('el pasto lejos de edificios cuenta como jardín de su unidad', () => {
    // El área de pasto más grande de la Unidad Central (el jardín entre L, I y K)
    const masGrande = campus.pasto.reduce((a, b) => {
      const tam = (p) => {
        const c = caja(p)
        return (c.x1 - c.x0) * (c.y1 - c.y0)
      }
      return tam(b) > tam(a) ? b : a
    })
    expect(detectarZona(puntoEtiqueta(masGrande)).id).toBe('jardin-unidad-central')
  })

  it('el techo de un edificio cuenta como el edificio aunque esté sobre su patio', () => {
    // 2A tiene forma de H; el volumen del ala sur cubre parte del patio al dibujarse
    const e = edificio('2A')
    expect(detectarZona(e.etiqueta).id).toBe('edificio-2A')
  })

  it('el campo dentro de la pista gana sobre la pista', () => {
    const [x, y] = puntoEtiqueta(campus.campos.find((c) => c.id === 'campo-pista').puntos)
    expect(detectarZona([x, y]).id).toBe('campo-pista')
  })

  it('un punto sobre los carriles es la pista', () => {
    // Punto medio entre el anillo exterior y el interior en su extremo norte
    const norteExt = Math.min(...campus.pista.exterior.map((p) => p[1]))
    const norteInt = Math.min(...campus.pista.interior.map((p) => p[1]))
    const xs = campus.pista.interior.map((p) => p[0])
    const x = (Math.min(...xs) + Math.max(...xs)) / 2
    expect(detectarZona([x, (norteExt + norteInt) / 2]).id).toBe('pista')
  })

  it('detecta estacionamientos, alberca y canchas', () => {
    for (const id of ['estacionamiento-5', 'alberca', 'cancha-basquet-1']) {
      const zona = zonaPorId(id)
      expect(detectarZona(puntoEtiqueta(zona.poligonos[0]))?.id).toBe(id)
    }
  })

  it('el edificio AI (sin letra en el plano) cuenta como jardín de la Unidad Central', () => {
    const ai = campus.construcciones[0]
    expect(detectarZona(puntoEtiqueta(ai.puntos)).id).toBe('jardin-unidad-central')
  })

  it('fuera del campus no hay zona', () => {
    expect(detectarZona([campus.limites.x + 1, campus.limites.y + 1])).toBeNull()
    expect(unidadDePunto([campus.limites.x + 1, campus.limites.y + 1])).toBeNull()
  })

  it('sabe en qué unidad está un punto', () => {
    expect(unidadDePunto(edificio('2D').etiqueta)).toBe('unidad-metal-mecanica')
    expect(unidadDePunto(edificio('3A').etiqueta)).toBe('unidad-posgrado')
    expect(unidadDePunto(edificio('K').etiqueta)).toBe('unidad-central')
  })
})
