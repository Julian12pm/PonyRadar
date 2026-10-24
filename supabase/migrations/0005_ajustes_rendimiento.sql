-- ════════════════════════════════════════════════════════════════════════════
-- 0005 · Ajustes que pidió el asesor de rendimiento de Supabase
--   · Índice para la llave foránea puntos_seguros.zona_id.
--   · Las políticas "for all" del admin también aplicaban a SELECT y se sumaban a la
--     política de lectura. Se separan por acción (insert / update / delete).
-- ════════════════════════════════════════════════════════════════════════════

create index puntos_seguros_zona_idx on public.puntos_seguros (zona_id);

-- Puntos seguros
drop policy "admin administra puntos seguros" on public.puntos_seguros;
create policy "admin crea puntos seguros" on public.puntos_seguros
  for insert to authenticated with check ((select private.es_admin()));
create policy "admin edita puntos seguros" on public.puntos_seguros
  for update to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "admin borra puntos seguros" on public.puntos_seguros
  for delete to authenticated using ((select private.es_admin()));

-- Personal de puntos seguros
drop policy "admin asigna personal" on public.personal_punto_seguro;
create policy "admin asigna personal" on public.personal_punto_seguro
  for insert to authenticated with check ((select private.es_admin()));
create policy "admin edita personal" on public.personal_punto_seguro
  for update to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "admin quita personal" on public.personal_punto_seguro
  for delete to authenticated using ((select private.es_admin()));

-- Semestres
drop policy "admin administra semestres" on public.semestres;
create policy "admin crea semestres" on public.semestres
  for insert to authenticated with check ((select private.es_admin()));
create policy "admin edita semestres" on public.semestres
  for update to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy "admin borra semestres" on public.semestres
  for delete to authenticated using ((select private.es_admin()));
