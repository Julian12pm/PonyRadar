-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de la migración 0009: solo se deja un objeto en puntos activos con personal.
-- Usa sus propios puntos de prueba, dentro de una transacción que termina en ROLLBACK.
--
-- Cómo correrlo: pegarlo completo en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

begin;
create temp table r (n serial, prueba text, resultado text) on commit drop;
create temp table g (k text, v uuid) on commit drop;
grant all on r, g to authenticated, anon;
grant usage on sequence r_n_seq to authenticated, anon;
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.prueba@morelia.tecnm.mx'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pepe.prueba@morelia.tecnm.mx');
insert into public.puntos_seguros (nombre, zona_id, activo) values
  ('P atendido', 'edificio-A', true), ('P sin personal', 'edificio-B', true), ('P inactivo', 'edificio-C', false);
insert into g select 'atendido', id from public.puntos_seguros where nombre = 'P atendido';
insert into g select 'vacio', id from public.puntos_seguros where nombre = 'P sin personal';
insert into g select 'inactivo', id from public.puntos_seguros where nombre = 'P inactivo';
insert into public.personal_punto_seguro (punto_id, perfil_id)
select v, '44444444-4444-4444-4444-444444444444' from g where k in ('atendido', 'inactivo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into r (prueba, resultado) select 'Ana no puede leer el personal (0)', count(*)::text from public.personal_punto_seguro;
insert into r (prueba, resultado) select 'disponibles: solo "P atendido"', string_agg(nombre, ', ' order by nombre) from public.puntos_disponibles() where nombre like 'P %';
insert into g select 'pin', public.crear_pin('verde', 'termos', 'Termo', 'Azul', 'edificio-K', '', 1, 1, 'Calcomanía');
do $$ begin
  perform public.dejar_en_punto_seguro((select v from g where k = 'pin'), (select v from g where k = 'vacio'));
  insert into r (prueba, resultado) values ('rechaza punto sin personal', 'NO');
exception when others then insert into r (prueba, resultado) values ('rechaza punto sin personal', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  perform public.dejar_en_punto_seguro((select v from g where k = 'pin'), (select v from g where k = 'inactivo'));
  insert into r (prueba, resultado) values ('rechaza punto inactivo', 'NO');
exception when others then insert into r (prueba, resultado) values ('rechaza punto inactivo', 'sí: ' || sqlerrm);
end $$;
select public.dejar_en_punto_seguro((select v from g where k = 'pin'), (select v from g where k = 'atendido'));
insert into r (prueba, resultado) select 'acepta punto activo con personal (en_camino)', estado::text from public.pines where id = (select v from g where k = 'pin');

reset role;
set local role anon;
do $$ begin
  perform * from public.puntos_disponibles();
  insert into r (prueba, resultado) values ('anon no consulta', 'NO');
exception when others then insert into r (prueba, resultado) values ('anon no consulta', 'sí: ' || sqlerrm);
end $$;
reset role;

select prueba, resultado from r order by n;
rollback;
