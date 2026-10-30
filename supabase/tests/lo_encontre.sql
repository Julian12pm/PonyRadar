-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de la migración 0010: "Lo encontré" una sola vez y solo el dueño reclama.
-- Beto perdió cosas, Ana las encuentra y Carla intenta meterse. Todo dentro de una
-- transacción que termina en ROLLBACK.
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
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla.prueba@morelia.tecnm.mx');

set local role authenticated;

-- Beto pierde sus audífonos; Ana marca "Lo encontré"
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into g select 'rojo', public.crear_pin('rojo', 'electronicos', 'Audífonos', 'Blancos', 'edificio-K', '', 1, 1, null)::text;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into g select 'verde', public.lo_encontre((select v::uuid from g where k = 'rojo'), '', '', 'Estuche rayado')::text;
insert into r (prueba, resultado) select 'el rojo queda "encontrado" (true)', encontrado::text from public.pines where id = (select v::uuid from g where k = 'rojo');

-- Carla ya no puede marcar "Lo encontré" en el mismo rojo
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ begin
  perform public.lo_encontre((select v::uuid from g where k = 'rojo'), '', '', 'Otro dato');
  insert into r (prueba, resultado) values ('segundo "Lo encontré" rechazado', 'NO');
exception when others then insert into r (prueba, resultado) values ('segundo "Lo encontré" rechazado', 'sí: ' || sqlerrm);
end $$;
insert into r (prueba, resultado) select 'sigue habiendo un solo verde (1)', count(*)::text from public.pines where pin_vinculado_id = (select v::uuid from g where k = 'rojo');

-- Carla tampoco puede reclamar el verde vinculado
do $$ begin
  perform public.solicitar_pin((select v::uuid from g where k = 'verde'), 'Son míos, de verdad');
  insert into r (prueba, resultado) values ('solo el dueño del rojo reclama el verde', 'NO');
exception when others then insert into r (prueba, resultado) values ('solo el dueño del rojo reclama el verde', 'sí: ' || sqlerrm);
end $$;

-- Beto sí lo reclama y se lo entregan: el rojo se cierra y deja de estar "encontrado"
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into g select 'sol', public.solicitar_pin((select v::uuid from g where k = 'verde'), 'Estuche rayado')::text;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.responder_solicitud((select v::uuid from g where k = 'sol'), 'aceptar');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into g select 'clave', public.generar_clave((select v::uuid from g where k = 'sol'));
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.verificar_clave((select v::uuid from g where k = 'sol'), (select v from g where k = 'clave'));
insert into r (prueba, resultado) select 'al entregar: rojo entregado y no "encontrado"', estado::text || ' / ' || encontrado from public.pines where id = (select v::uuid from g where k = 'rojo');

-- Otro rojo: si su verde caduca, el rojo vuelve a "Se busca" (con nota) pero sigue bloqueado
-- para otro "Lo encontré" y solo su dueño reclama el verde; si queda "no reclamado", se libera
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into g select 'rojo2', public.crear_pin('rojo', 'termos', 'Termo', 'Azul', 'edificio-K', '', 2, 2, null)::text;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into g select 'verde2', public.lo_encontre((select v::uuid from g where k = 'rojo2'), '', '', 'Calcomanía')::text;
insert into r (prueba, resultado) select 'verde vigente: rojo oculto (true) y con verde_en_curso', encontrado::text || ' / ' || (verde_en_curso = (select v::uuid from g where k = 'verde2')) from public.pines where id = (select v::uuid from g where k = 'rojo2');
reset role;
-- Como lo haría la tarea de pg_cron: caducado y con sus 72 h ya vencidas
update public.pines set estado = 'caducado', expira_en = now() - interval '1 hour' where id = (select v::uuid from g where k = 'verde2');
insert into r (prueba, resultado) select 'verde caducado: el rojo vuelve a mostrarse (false) con la nota (true)', encontrado::text || ' / ' || (verde_en_curso = (select v::uuid from g where k = 'verde2')) from public.pines where id = (select v::uuid from g where k = 'rojo2');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ begin
  perform public.lo_encontre((select v::uuid from g where k = 'rojo2'), '', '', 'Otro dato');
  insert into r (prueba, resultado) values ('verde caducado sigue en curso: se bloquea', 'NO');
exception when others then insert into r (prueba, resultado) values ('verde caducado sigue en curso: se bloquea', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  perform public.solicitar_pin((select v::uuid from g where k = 'verde2'), 'Es mío');
  insert into r (prueba, resultado) values ('el verde caducado tampoco lo reclama otra persona', 'NO');
exception when others then insert into r (prueba, resultado) values ('el verde caducado tampoco lo reclama otra persona', 'sí: ' || sqlerrm);
end $$;
-- Beto (dueño del rojo) sí reclama el verde caducado
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into g select 'sol2', public.solicitar_pin((select v::uuid from g where k = 'verde2'), 'Calcomanía')::text;
insert into r (prueba, resultado) select 'el dueño reclama el verde caducado: con_solicitud', estado::text from public.pines where id = (select v::uuid from g where k = 'verde2');
insert into r (prueba, resultado) select 'mientras tanto el rojo se oculta otra vez (true)', encontrado::text from public.pines where id = (select v::uuid from g where k = 'rojo2');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.responder_solicitud((select v::uuid from g where k = 'sol2'), 'rechazar');
insert into r (prueba, resultado) select 'si lo rechazan: verde caducado y rojo visible', (select estado::text from public.pines where id = (select v::uuid from g where k = 'verde2')) || ' / ' || encontrado from public.pines where id = (select v::uuid from g where k = 'rojo2');
reset role;
update public.pines set estado = 'no_reclamado' where id = (select v::uuid from g where k = 'verde2');
insert into r (prueba, resultado) select 'verde no reclamado: el rojo queda libre (false / sin verde)', encontrado::text || ' / ' || coalesce(verde_en_curso::text, 'sin verde') from public.pines where id = (select v::uuid from g where k = 'rojo2');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into g select 'verde3', public.lo_encontre((select v::uuid from g where k = 'rojo2'), '', '', 'Otro dato')::text;
insert into r (prueba, resultado) select 'entonces sí se puede volver a marcar', (count(*) = 1)::text from public.pines where id = (select v::uuid from g where k = 'verde3');

-- Un verde sin vínculo lo puede reclamar cualquiera (como siempre)
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into g select 'suelto', public.crear_pin('verde', 'llaves', 'Llavero', 'Llavero', 'edificio-K', '', 3, 3, 'Llave morada')::text;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into r (prueba, resultado) select 'verde sin vínculo: cualquiera reclama', (public.solicitar_pin((select v::uuid from g where k = 'suelto'), 'Llave morada') is not null)::text;

reset role;
select prueba, resultado from r order by n;
rollback;
