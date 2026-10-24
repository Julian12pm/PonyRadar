-- ════════════════════════════════════════════════════════════════════════════
-- Datos de demo de PonyRadar
-- Se pueden correr varias veces: no duplican filas.
-- (En la Fase 6 se agregan usuarios y pines de demo.)
-- ════════════════════════════════════════════════════════════════════════════

-- Semestre vigente para la demo (el admin administra esta tabla desde su panel)
insert into public.semestres (nombre, fecha_inicio, fecha_fin)
values ('Agosto–Diciembre 2026', '2026-08-01', '2026-12-31')
on conflict (nombre) do nothing;

-- Punto seguro principal: el Centro de Información (Biblioteca), edificio AF
insert into public.puntos_seguros (nombre, zona_id)
values ('Biblioteca (AF)', 'edificio-AF')
on conflict (nombre) do nothing;
