-- ════════════════════════════════════════════════════════════════════════════
-- 0009 · Solo se pueden dejar objetos en puntos seguros que alguien atiende
--   · puntos_disponibles(): puntos activos con al menos una persona asignada. La comunidad
--     no puede leer quién es el personal (RLS), así que esta función solo dice cuáles tienen.
--   · dejar_en_punto_seguro() rechaza un punto inactivo o sin personal.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function private.punto_atendido(punto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.puntos_seguros s
    where s.id = punto
      and s.activo
      and exists (select 1 from public.personal_punto_seguro p where p.punto_id = s.id)
  );
$$;
revoke execute on function private.punto_atendido(uuid) from public, anon, authenticated;

/** Puntos seguros donde se puede dejar un objeto (activos y con personal). */
create or replace function public.puntos_disponibles()
returns table (id uuid, nombre text, zona_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.nombre, s.zona_id
  from public.puntos_seguros s
  where private.punto_atendido(s.id)
  order by s.nombre;
$$;

create or replace function public.dejar_en_punto_seguro(p_pin uuid, p_punto uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.pines;
begin
  select * into v_pin from public.pines where id = p_pin for update;
  if not found or v_pin.autor_id is distinct from (select auth.uid()) or v_pin.tipo <> 'verde' then
    raise exception 'Solo quien encontró el objeto puede dejarlo en un punto seguro';
  end if;
  if v_pin.estado not in ('activo', 'caducado') then
    raise exception 'El objeto tiene una solicitud en curso o ya no está contigo';
  end if;
  if not private.punto_atendido(p_punto) then
    raise exception 'Ese punto seguro no está disponible: está desactivado o nadie lo atiende';
  end if;
  update public.pines
  set estado = 'en_camino', punto_seguro_id = p_punto, en_camino_desde = now(),
      aviso_24h_enviado = false
  where id = p_pin;
end;
$$;

revoke execute on function public.puntos_disponibles() from public, anon;
grant execute on function public.puntos_disponibles() to authenticated;
