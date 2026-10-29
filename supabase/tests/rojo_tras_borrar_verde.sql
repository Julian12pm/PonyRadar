-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de la migración 0012: si el admin borra un verde vinculado, el rojo vuelve a
-- mostrarse y acepta otro "Lo encontré". Todo dentro de una transacción con ROLLBACK.
--
-- Cómo correrlo: pegarlo completo en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

begin;
create temp table r (n serial, prueba text, resultado text) on commit drop;
create temp table g (k text, v text) on commit drop;
grant all on r, g to authenticated, anon;
grant usage on sequence r_n_seq to authenticated, anon;
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.prueba@morelia.tecnm.mx'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto.prueba@morelia.tecnm.mx'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla.prueba@morelia.tecnm.mx'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zoe.prueba@morelia.tecnm.mx');
update public.perfiles set rol = 'admin' where id = '55555555-5555-5555-5555-555555555555';

set local role authenticated;
-- Beto pierde algo; Ana marca "Lo encontré" (con un título basura en el verde)
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into g select 'rojo', public.crear_pin('rojo', 'electronicos', 'Audífonos', 'Blancos', 'edificio-K', '', 1, 1, null)::text;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into g select 'verde', public.lo_encontre((select v::uuid from g where k = 'rojo'), '', '', 'Estuche rayado')::text;
insert into r (prueba, resultado) select 'antes de borrar: rojo oculto y con su verde (true / true)', encontrado::text || ' / ' || (verde_en_curso = (select v::uuid from g where k = 'verde')) from public.pines where id = (select v::uuid from g where k = 'rojo');

-- El admin borra el verde
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select public.admin_eliminar_pin((select v::uuid from g where k = 'verde'), 'Era una prueba');
insert into r (prueba, resultado) select 'tras borrar el verde: rojo visible y sin verde (false / sin verde)', encontrado::text || ' / ' || coalesce(verde_en_curso::text, 'sin verde') from public.pines where id = (select v::uuid from g where k = 'rojo');

-- Ya se puede volver a marcar "Lo encontré"
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into g select 'verde2', public.lo_encontre((select v::uuid from g where k = 'rojo'), '', '', 'Otro dato')::text;
insert into r (prueba, resultado) select 'otro "Lo encontré" sí se puede (true)', encontrado::text from public.pines where id = (select v::uuid from g where k = 'rojo');

-- Borrar un pin sin vínculo no afecta a nadie
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into g select 'suelto', public.crear_pin('verde', 'llaves', 'Llavero', '', 'edificio-K', '', 3, 3, 'Llave morada')::text;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select public.admin_eliminar_pin((select v::uuid from g where k = 'suelto'), 'Prueba');
insert into r (prueba, resultado) select 'borrar un verde sin vínculo: el rojo no cambia (true)', encontrado::text from public.pines where id = (select v::uuid from g where k = 'rojo');

reset role;
select prueba, resultado from r order by n;
rollback;
