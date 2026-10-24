// Textos de tiempo relativos, como "hace 5 min" o "hace 2 días".

/**
 * @param {Date|string|number} fecha momento del reporte
 * @param {Date} ahora momento actual (se pasa como parámetro para poder probarlo)
 */
export function haceCuanto(fecha, ahora = new Date()) {
  const minutos = Math.floor((ahora - new Date(fecha)) / 60000)
  if (minutos < 1) return 'hace un momento'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}
