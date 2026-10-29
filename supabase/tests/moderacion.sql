-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de la migración 0011 (moderación): una cuenta por buzón, alias autorizados,
-- eliminar pines (admin) y títulos con letras. Todo dentro de una transacción con ROLLBACK.
--
-- Cómo correrlo: pegarlo completo en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

begin;
create temp table r (n serial, prueba text, resultado text) on commit drop;
create temp table g (k text, v text) on commit drop;
grant all on r, g to authenticated, anon;
grant usage on sequence r_n_seq to authenticated, anon;

-- ─── Buzón real ───
insert into r (prueba, resultado)
select 'buzón de ' || c, private.buzon(c)
from unnest(array['l23121064+sec@morelia.tecnm.mx', 'L23121064+Otro.Mas@Morelia.TecNM.mx', 'l23121064@morelia.tecnm.mx']) c;

-- ─── Registro: el hook decide con private.motivo_rechazo_cuenta ───
insert into auth.users (id, instance_id, aud, role, email) values
  ('91111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x9prueba@morelia.tecnm.mx');
insert into r (prueba, resultado) select 'cuenta normal: se crea', correo from public.perfiles where id = '91111111-1111-1111-1111-111111111111';
insert into r (prueba, resultado)
select 'hook rechaza un alias nuevo (403)', public.hook_solo_correo_institucional('{"user":{"email":"x9prueba+sec@morelia.tecnm.mx"}}') -> 'error' ->> 'message';
do $$ begin
  insert into auth.users (id, instance_id, aud, role, email) values ('92222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x9prueba+sec@morelia.tecnm.mx');
  insert into r (prueba, resultado) values ('el trigger también rechaza el alias', 'NO');
exception when others then insert into r (prueba, resultado) values ('el trigger también rechaza el alias', 'sí: ' || sqlerrm);
end $$;
insert into r (prueba, resultado)
select 'hook sigue rechazando otros dominios', public.hook_solo_correo_institucional('{"user":{"email":"x9prueba@gmail.com"}}') -> 'error' ->> 'message';

-- Alias autorizado por el admin: sí se crea, aunque ya exista la cuenta normal
insert into public.alias_permitidos (correo, nota) values ('x9prueba+admin@morelia.tecnm.mx', 'prueba');
insert into r (prueba, resultado)
select 'hook acepta un alias autorizado ({})', public.hook_solo_correo_institucional('{"user":{"email":"X9prueba+admin@morelia.tecnm.mx"}}')::text;
insert into auth.users (id, instance_id, aud, role, email) values
  ('93333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x9prueba+admin@morelia.tecnm.mx');
insert into r (prueba, resultado) select 'alias autorizado: se crea', correo from public.perfiles where id = '93333333-3333-3333-3333-333333333333';
insert into r (prueba, resultado)
select 'el admin del dueño ya viene autorizado', count(*)::text from public.alias_permitidos where correo = 'l23121115+admin@morelia.tecnm.mx';

-- Una cuenta con alias que ya existía (antes de esta regla) no deja crear otra del mismo buzón
insert into auth.users (id, instance_id, aud, role, email) values
  ('94444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x8prueba@morelia.tecnm.mx');
update public.perfiles set correo = 'x8prueba+viejo@morelia.tecnm.mx' where id = '94444444-4444-4444-4444-444444444444';
insert into r (prueba, resultado)
select 'buzón con una cuenta con alias: no se crea otra', public.hook_solo_correo_institucional('{"user":{"email":"x8prueba@morelia.tecnm.mx"}}') -> 'error' ->> 'message';

-- ─── Títulos ───
insert into r (prueba, resultado)
select 'título "' || t || '"', private.titulo_valido(t)::text
from unnest(array['Llaves', 'INE', 'Ñu', '!!!!', '¿¿?? 123', '   ab   ', 'Termo 2']) t;

-- Admin de prueba y una persona de la comunidad
insert into auth.users (id, instance_id, aud, role, email) values
  ('95555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x7admin@morelia.tecnm.mx');
update public.perfiles set rol = 'admin' where id = '95555555-5555-5555-5555-555555555555';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin
  perform public.crear_pin('rojo', 'otros', '!!!!', '', 'edificio-K', '', 1, 1, null);
  insert into r (prueba, resultado) values ('crear_pin rechaza un título sin letras', 'NO');
exception when others then insert into r (prueba, resultado) values ('crear_pin rechaza un título sin letras', 'sí: ' || sqlerrm);
end $$;
insert into g select 'rojo', public.crear_pin('rojo', 'otros', 'Mochila basura', '', 'edificio-K', '', 1, 1, null)::text;
insert into g select 'verde', public.crear_pin('verde', 'otros', 'Mochila', '', 'edificio-K', '', 2, 2, 'Llavero rojo')::text;
reset role;
update public.pines set pin_vinculado_id = (select v::uuid from g where k = 'rojo') where id = (select v::uuid from g where k = 'verde');
set local role authenticated;

-- ─── Eliminar pin ───
do $$ begin
  perform public.admin_eliminar_pin((select v::uuid from g where k = 'rojo'), 'Título basura');
  insert into r (prueba, resultado) values ('comunidad no elimina pines', 'NO');
exception when others then insert into r (prueba, resultado) values ('comunidad no elimina pines', 'sí: ' || sqlerrm);
end $$;
select set_config('request.jwt.claims', '{"sub":"95555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$ begin
  perform public.admin_eliminar_pin((select v::uuid from g where k = 'rojo'), '  ');
  insert into r (prueba, resultado) values ('pide motivo', 'NO');
exception when others then insert into r (prueba, resultado) values ('pide motivo', 'sí: ' || sqlerrm);
end $$;
select public.admin_eliminar_pin((select v::uuid from g where k = 'rojo'), 'Título basura');
insert into r (prueba, resultado) select 'el pin ya no existe (0)', count(*)::text from public.pines where id = (select v::uuid from g where k = 'rojo');
insert into r (prueba, resultado) select 'queda registro con motivo', accion || ' / ' || titulo || ' / ' || motivo from public.moderacion where pin_id = (select v::uuid from g where k = 'rojo');
insert into r (prueba, resultado) select 'el verde vinculado sigue, sin vínculo', coalesce(pin_vinculado_id::text, 'sin vínculo') from public.pines where id = (select v::uuid from g where k = 'verde');
insert into r (prueba, resultado) select 'el admin ve los alias permitidos (≥2)', count(*)::text from public.alias_permitidos;

select set_config('request.jwt.claims', '{"sub":"91111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into r (prueba, resultado) select 'la comunidad no ve los alias (0)', count(*)::text from public.alias_permitidos;
insert into r (prueba, resultado) select 'ni la moderación (0)', count(*)::text from public.moderacion;
do $$ begin
  insert into public.alias_permitidos (correo) values ('x9prueba+pirata@morelia.tecnm.mx');
  insert into r (prueba, resultado) values ('la comunidad no autoriza alias', 'NO');
exception when others then insert into r (prueba, resultado) values ('la comunidad no autoriza alias', 'sí: ' || sqlerrm);
end $$;

reset role;
select prueba, resultado from r order by n;
rollback;
