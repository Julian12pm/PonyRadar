// Genera supabase/migrations/0002_zonas.sql a partir de src/mapa/zonas.js, para que la app
// y la base de datos usen exactamente los mismos ids de zona.
// Uso: npm run zonas:sql   (volver a correrlo si cambian las zonas y crear una migración nueva)

import { writeFile } from 'node:fs/promises'
import { JARDINES, ZONAS, nombreCorto } from '../../src/mapa/zonas.js'

const texto = (s) => `'${String(s).replaceAll("'", "''")}'`

const filas = [...ZONAS, ...JARDINES].map((z) => {
  if (!z.unidad) throw new Error(`La zona ${z.id} no tiene unidad`)
  // Nombre que se muestra: "Edificio K · Aulas y Delegación Sindical" o el nombre del área
  const nombre = z.tipo === 'edificio' ? `${nombreCorto(z)} · ${z.nombre}` : z.nombre
  return `  (${texto(z.id)}, ${texto(z.tipo)}, ${texto(nombre)}, ${texto(z.unidad)})`
})

const sql = `-- ════════════════════════════════════════════════════════════════════════════
-- 0002 · Zonas del mapa
-- Generado con scripts/supabase/zonas-sql.mjs a partir de src/mapa/zonas.js
-- (geometría de OpenStreetMap © OpenStreetMap contributors). No editar a mano.
-- ${filas.length} zonas: edificios, áreas exteriores y un jardín por unidad.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.zonas (id, tipo, nombre, unidad) values
${filas.join(',\n')}
on conflict (id) do update
  set tipo = excluded.tipo, nombre = excluded.nombre, unidad = excluded.unidad;
`

const destino = new URL('../../supabase/migrations/0002_zonas.sql', import.meta.url)
await writeFile(destino, sql)
console.log(`0002_zonas.sql generado con ${filas.length} zonas`)
