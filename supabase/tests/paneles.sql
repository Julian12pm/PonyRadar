-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de la Fase 5 (migración 0008) y de los correos con "+".
-- Zoe es admin, Ana es comunidad y Carla tiene strikes. Todo ocurre dentro de una
-- transacción que termina en ROLLBACK.
-- Cada fila del resultado debe decir "sí…", "true" o el valor esperado entre paréntesis.
--
-- Cómo correrlo: pegarlo completo en Supabase → SQL Editor (requiere el seed con la Biblioteca).
-- ════════════════════════════════════════════════════════════════════════════

begin;
create temp table resultados (n serial, prueba text, resultado text) on commit drop;
create temp table guardado (clave text, valor text) on commit drop;
grant all on resultados, guardado to authenticated, anon;
grant usage on sequence resultados_n_seq to authenticated, anon;

-- ─── Correos con "+" (alias de Microsoft 365) ───
insert into resultados (prueba, resultado)
select 'correo ' || c || ' (' || e || ')', private.correo_permitido(c)::text
from (values
  ('l23121115+admin@morelia.tecnm.mx', true),
  ('L23121115+Punto.Seguro@Morelia.TecNM.mx', true),
  ('l23121115+admin@gmail.com', false),
  ('l23121115+admin@morelia.tecnm.mx.evil.com', false),
  ('l23121115+@morelia.tecnm.mx@gmail.com', false)
) as t(c, e);
insert into resultados (prueba, resultado)
select 'hook acepta + institucional ({})', public.hook_solo_correo_institucional('{"user":{"email":"a+b@morelia.tecnm.mx"}}')::text;
insert into resultados (prueba, resultado)
select 'hook rechaza + de otro dominio (403)', public.hook_solo_correo_institucional('{"user":{"email":"a+b@gmail.com"}}') -> 'error' ->> 'http_code';

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.prueba@morelia.tecnm.mx'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla.prueba@morelia.tecnm.mx'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zoe.prueba+admin@morelia.tecnm.mx');
insert into resultados (prueba, resultado) select 'el trigger crea perfil con +', correo from public.perfiles where id = '55555555-5555-5555-5555-555555555555';
do $$ begin
  insert into auth.users (id, instance_id, aud, role, email) values ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zoe.prueba+admin@gmail.com');
  insert into resultados (prueba, resultado) values ('el trigger rechaza + de otro dominio', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('el trigger rechaza + de otro dominio', 'sí: ' || sqlerrm);
end $$;

-- El primer admin se asigna por SQL
update public.perfiles set rol = 'admin' where id = '55555555-5555-5555-5555-555555555555';
insert into guardado select 'punto', id::text from public.puntos_seguros where nombre = 'Biblioteca (AF)';

-- Carla con 3 strikes (suspendida) para probar quitar strikes
insert into public.pines (id, autor_id, tipo, categoria, titulo, zona_id, x, y)
values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'verde', 'llaves', 'Llavero', 'edificio-K', 0, 0);
insert into public.solicitudes (pin_id, solicitante_id, respuesta, estado)
select '77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 'Intento ' || i, 'impostor' from generate_series(1, 3) i;
insert into public.strikes (perfil_id, solicitud_id)
select '33333333-3333-3333-3333-333333333333', id from public.solicitudes where respuesta like 'Intento %';

set local role authenticated;

-- ─── Ana (comunidad) no puede nada de admin ───
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin
  perform public.admin_cambiar_rol('11111111-1111-1111-1111-111111111111', 'admin');
  insert into resultados (prueba, resultado) values ('comunidad no se hace admin', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('comunidad no se hace admin', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  update public.perfiles set rol = 'admin' where id = '11111111-1111-1111-1111-111111111111';
  insert into resultados (prueba, resultado) values ('tampoco cambiando la tabla directo', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('tampoco cambiando la tabla directo', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  perform public.admin_asignar_personal((select valor::uuid from guardado where clave = 'punto'), 'ana.prueba@morelia.tecnm.mx');
  insert into resultados (prueba, resultado) values ('comunidad no asigna personal', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('comunidad no asigna personal', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  perform public.admin_quitar_strike((select id from public.strikes limit 1));
  insert into resultados (prueba, resultado) values ('comunidad no quita strikes', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('comunidad no quita strikes', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  insert into public.puntos_seguros (nombre, zona_id) values ('Pirata', 'edificio-K');
  insert into resultados (prueba, resultado) values ('comunidad no crea puntos seguros', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('comunidad no crea puntos seguros', 'sí: ' || sqlerrm);
end $$;

-- ─── Zoe (admin) ───
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$ begin
  perform public.admin_cambiar_rol('55555555-5555-5555-5555-555555555555', 'comunidad');
  insert into resultados (prueba, resultado) values ('el admin no se quita su rol', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('el admin no se quita su rol', 'sí: ' || sqlerrm);
end $$;
insert into resultados (prueba, resultado) select 'Zoe sigue siendo admin', rol::text from public.perfiles where id = '55555555-5555-5555-5555-555555555555';
insert into resultados (prueba, resultado) select 'el admin ve todos los perfiles (≥3)', count(*)::text from public.perfiles;

-- Se asigna a sí misma a la Biblioteca y conserva el rol admin
select public.admin_asignar_personal((select valor::uuid from guardado where clave = 'punto'), 'ZOE.prueba+admin@morelia.tecnm.mx ');
insert into resultados (prueba, resultado) select 'Zoe es personal de la Biblioteca y sigue admin', private.es_personal_de((select valor::uuid from guardado where clave = 'punto'))::text || ' / ' || rol from public.perfiles where id = '55555555-5555-5555-5555-555555555555';
select public.admin_asignar_personal((select valor::uuid from guardado where clave = 'punto'), 'zoe.prueba+admin@morelia.tecnm.mx');
insert into resultados (prueba, resultado) select 'asignar dos veces no duplica (1)', count(*)::text from public.personal_punto_seguro where perfil_id = '55555555-5555-5555-5555-555555555555';

-- Asigna a Ana: pasa a punto_seguro; al quitarla vuelve a comunidad
select public.admin_asignar_personal((select valor::uuid from guardado where clave = 'punto'), 'ana.prueba@morelia.tecnm.mx');
insert into resultados (prueba, resultado) select 'Ana asignada → punto_seguro', rol::text from public.perfiles where id = '11111111-1111-1111-1111-111111111111';
select public.admin_quitar_personal((select valor::uuid from guardado where clave = 'punto'), '11111111-1111-1111-1111-111111111111');
insert into resultados (prueba, resultado) select 'Ana quitada → comunidad', rol::text from public.perfiles where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform public.admin_asignar_personal((select valor::uuid from guardado where clave = 'punto'), 'nadie@morelia.tecnm.mx');
  insert into resultados (prueba, resultado) values ('correo sin cuenta', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('correo sin cuenta', 'sí: ' || sqlerrm);
end $$;

-- Cambiar rol a otro: Ana admin y de vuelta (y al pasar a comunidad pierde sus asignaciones)
select public.admin_cambiar_rol('11111111-1111-1111-1111-111111111111', 'admin');
insert into resultados (prueba, resultado) select 'Zoe hace admin a Ana', rol::text from public.perfiles where id = '11111111-1111-1111-1111-111111111111';
select public.admin_asignar_personal((select valor::uuid from guardado where clave = 'punto'), 'ana.prueba@morelia.tecnm.mx');
select public.admin_cambiar_rol('11111111-1111-1111-1111-111111111111', 'comunidad');
insert into resultados (prueba, resultado) select 'Ana vuelve a comunidad sin asignaciones (0)', count(*)::text from public.personal_punto_seguro where perfil_id = '11111111-1111-1111-1111-111111111111';

-- Strikes: Carla tiene 3 y está suspendida
insert into resultados (prueba, resultado) select 'Carla: 3 strikes vigentes', public.admin_strikes_vigentes('33333333-3333-3333-3333-333333333333')::text;
insert into resultados (prueba, resultado) select 'Carla suspendida', (suspendido_hasta > now())::text from public.perfiles where id = '33333333-3333-3333-3333-333333333333';
select public.admin_quitar_strike((select id from public.strikes where perfil_id = '33333333-3333-3333-3333-333333333333' limit 1));
insert into resultados (prueba, resultado) select 'quitar uno: 2 vigentes y sin suspensión', public.admin_strikes_vigentes('33333333-3333-3333-3333-333333333333')::text || ' / ' || coalesce(suspendido_hasta::text, 'sin suspensión') from public.perfiles where id = '33333333-3333-3333-3333-333333333333';
do $$ begin
  perform public.admin_quitar_strike((select id from public.strikes where quitado_en is not null limit 1));
  insert into resultados (prueba, resultado) values ('no se quita dos veces', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('no se quita dos veces', 'sí: ' || sqlerrm);
end $$;

-- Desbloquear
reset role;
update public.perfiles set bloqueado = true, suspendido_hasta = now() + interval '30 days' where id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select public.admin_desbloquear('33333333-3333-3333-3333-333333333333');
insert into resultados (prueba, resultado) select 'desbloqueada', (not bloqueado and suspendido_hasta is null)::text from public.perfiles where id = '33333333-3333-3333-3333-333333333333';

-- Puntos seguros y semestres: el admin los edita directo (RLS)
insert into public.puntos_seguros (nombre, zona_id) values ('Prueba punto', 'edificio-A');
update public.puntos_seguros set activo = false where nombre = 'Prueba punto';
insert into resultados (prueba, resultado) select 'admin crea y desactiva un punto seguro', (not activo)::text from public.puntos_seguros where nombre = 'Prueba punto';
insert into public.semestres (nombre, fecha_inicio, fecha_fin) values ('Prueba Enero–Junio 2027', '2027-01-15', '2027-06-30');
insert into resultados (prueba, resultado) select 'admin crea un semestre', count(*)::text from public.semestres where nombre = 'Prueba Enero–Junio 2027';

-- Sin sesión
reset role;
set local role anon;
do $$ begin
  perform public.admin_desbloquear('33333333-3333-3333-3333-333333333333');
  insert into resultados (prueba, resultado) values ('anon no usa funciones de admin', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('anon no usa funciones de admin', 'sí: ' || sqlerrm);
end $$;
reset role;

select prueba, resultado from resultados order by n;
rollback;
