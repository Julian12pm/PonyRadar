-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de puntos seguros y reglas (migración 0007).
-- Ana encuentra objetos, Beto es dueño, Carla es impostora, Pepe atiende la Biblioteca
-- y Zoe es admin. Todo ocurre dentro de una transacción que termina en ROLLBACK.
-- Para simular el paso del tiempo se cambian fechas directamente (como postgres).
-- Cada fila del resultado debe decir "sí…", "true" o el valor esperado entre paréntesis.
--
-- Cómo correrlo: pegarlo completo en Supabase → SQL Editor (requiere el seed con la Biblioteca).
-- ════════════════════════════════════════════════════════════════════════════

begin;
create temp table resultados (n serial, prueba text, resultado text) on commit drop;
create temp table guardado (clave text, valor text) on commit drop;
grant all on resultados, guardado to authenticated, anon;
grant usage on sequence resultados_n_seq to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.prueba@morelia.tecnm.mx'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto.prueba@morelia.tecnm.mx'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla.prueba@morelia.tecnm.mx'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pepe.prueba@morelia.tecnm.mx'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zoe.prueba@morelia.tecnm.mx');
update public.perfiles set rol = 'punto_seguro' where id = '44444444-4444-4444-4444-444444444444';
update public.perfiles set rol = 'admin' where id = '55555555-5555-5555-5555-555555555555';
insert into guardado select 'punto', id::text from public.puntos_seguros where nombre = 'Biblioteca (AF)';
insert into public.personal_punto_seguro (punto_id, perfil_id)
select valor::uuid, '44444444-4444-4444-4444-444444444444' from guardado where clave = 'punto';
insert into resultados (prueba, resultado) select 'tarea de pg_cron programada (1)', count(*)::text from cron.job where jobname = 'ponyradar-reglas-de-tiempo';

set local role authenticated;

-- ─── Ana deja un objeto en la Biblioteca ───
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into guardado select 'verde', public.crear_pin('verde', 'electronicos', 'Calculadora', 'Gris', 'edificio-K', '', 1, 1, 'Nombre grabado: Beto')::text;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin
  perform public.dejar_en_punto_seguro((select valor::uuid from guardado where clave = 'verde'), (select valor::uuid from guardado where clave = 'punto'));
  insert into resultados (prueba, resultado) values ('solo quien lo encontró lo deja', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('solo quien lo encontró lo deja', 'sí: ' || sqlerrm);
end $$;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.dejar_en_punto_seguro((select valor::uuid from guardado where clave = 'verde'), (select valor::uuid from guardado where clave = 'punto'));
insert into resultados (prueba, resultado) select 'queda en_camino', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'verde');
do $$ begin
  perform public.confirmar_recepcion((select valor::uuid from guardado where clave = 'verde'));
  insert into resultados (prueba, resultado) values ('Ana no confirma la recepción', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('Ana no confirma la recepción', 'sí: ' || sqlerrm);
end $$;

-- ─── Pepe confirma; ve el dato ciego para revisar reclamos ───
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Pepe ve el dato ciego en camino (1)', count(*)::text from public.datos_ciegos;
select public.confirmar_recepcion((select valor::uuid from guardado where clave = 'verde'));
insert into resultados (prueba, resultado) select 'queda en_resguardo', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'verde');

-- ─── Beto lo reclama en resguardo: responde Pepe, no Ana ───
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Beto no ve el dato ciego (0)', count(*)::text from public.datos_ciegos;
insert into guardado select 'sol', public.solicitar_pin((select valor::uuid from guardado where clave = 'verde'), 'Tiene mi nombre grabado')::text;
insert into resultados (prueba, resultado) select 'sigue en_resguardo con la solicitud', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'verde');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Ana ya no recibe el reclamo (0)', count(*)::text from public.avisos where tipo = 'reclamaron_mi_objeto';
do $$ begin
  perform public.responder_solicitud((select valor::uuid from guardado where clave = 'sol'), 'aceptar');
  insert into resultados (prueba, resultado) values ('Ana quedó deslindada', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('Ana quedó deslindada', 'sí: ' || sqlerrm);
end $$;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Pepe recibe el reclamo (1)', count(*)::text from public.avisos where tipo = 'reclamaron_mi_objeto';
insert into resultados (prueba, resultado) select 'Pepe ve la solicitud (1)', count(*)::text from public.solicitudes;
select public.responder_solicitud((select valor::uuid from guardado where clave = 'sol'), 'aceptar');
insert into resultados (prueba, resultado) select 'Pepe ve el contacto del dueño', correo || ' / ' || papel from public.contacto_del_caso((select valor::uuid from guardado where clave = 'sol'));
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Beto ve el punto seguro, sin correo', nombre || ' / ' || coalesce(correo, 'sin correo') || ' / ' || papel from public.contacto_del_caso((select valor::uuid from guardado where clave = 'sol'));
insert into guardado select 'clave', public.generar_clave((select valor::uuid from guardado where clave = 'sol'));
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Pepe escribe la clave', (public.verificar_clave((select valor::uuid from guardado where clave = 'sol'), (select valor from guardado where clave = 'clave')) ->> 'ok');
insert into resultados (prueba, resultado) select 'en_resguardo → entregado', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'verde');

-- ─── Strikes: 1–2 aviso, 3 suspensión 7 días ───
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into guardado select 'verde2', public.crear_pin('verde', 'llaves', 'Llavero', 'Llavero', 'edificio-K', '', 2, 2, 'Llave morada')::text;
do $$
declare i int;
begin
  for i in 1..3 loop
    perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    insert into guardado select 'imp' || i, public.solicitar_pin((select valor::uuid from guardado where clave = 'verde2'), 'Intento ' || i)::text;
    perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    perform public.responder_solicitud((select valor::uuid from guardado where clave = 'imp' || i), 'impostor');
  end loop;
end $$;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Carla tiene 3 strikes (3)', public.mis_strikes()::text;
insert into resultados (prueba, resultado) select 'Carla recibió 3 avisos de impostor (3)', count(*)::text from public.avisos a join public.solicitudes s on s.id = a.solicitud_id where a.tipo = 'solicitud_rechazada' and s.estado = 'impostor';
insert into resultados (prueba, resultado) select '3 strikes: suspendida ~7 días', (suspendido_hasta between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour')::text from public.perfiles;
do $$ begin
  perform public.solicitar_pin((select valor::uuid from guardado where clave = 'verde2'), 'Otra vez');
  insert into resultados (prueba, resultado) values ('suspendida no envía solicitudes', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('suspendida no envía solicitudes', 'sí: ' || sqlerrm);
end $$;

-- 4.º y 5.º strike (se insertan directo como postgres para no depender de la suspensión)
reset role;
insert into public.solicitudes (pin_id, solicitante_id, respuesta, estado)
select (select valor::uuid from guardado where clave = 'verde2'), '33333333-3333-3333-3333-333333333333', 'Intento ' || i, 'impostor'
from generate_series(4, 5) i;
insert into public.strikes (perfil_id, solicitud_id)
select '33333333-3333-3333-3333-333333333333', id from public.solicitudes where respuesta = 'Intento 4';
insert into resultados (prueba, resultado) select '4 strikes: suspendida ~30 días', (suspendido_hasta between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour')::text from public.perfiles where id = '33333333-3333-3333-3333-333333333333';
insert into public.strikes (perfil_id, solicitud_id)
select '33333333-3333-3333-3333-333333333333', id from public.solicitudes where respuesta = 'Intento 5';
insert into resultados (prueba, resultado) select '5 strikes: bloqueada', bloqueado::text from public.perfiles where id = '33333333-3333-3333-3333-333333333333';
-- Un strike quitado por el admin o de otro semestre no cuenta
update public.strikes set quitado_en = now() where solicitud_id = (select id from public.solicitudes where respuesta = 'Intento 5');
update public.strikes set creado_en = '2026-03-01' where solicitud_id = (select id from public.solicitudes where respuesta = 'Intento 4');
insert into resultados (prueba, resultado) select 'cuentan solo los vigentes (3)', private.strikes_vigentes('33333333-3333-3333-3333-333333333333')::text;

-- ─── Renovar un pin rojo (una vez, dentro de 30 días) ───
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into guardado select 'rojo', public.crear_pin('rojo', 'mochilas', 'Mochila', 'Negra', 'edificio-K', '', 3, 3, null)::text;
do $$ begin
  perform public.renovar_pin((select valor::uuid from guardado where clave = 'rojo'));
  insert into resultados (prueba, resultado) values ('no se renueva antes de caducar', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('no se renueva antes de caducar', 'sí: ' || sqlerrm);
end $$;
reset role;
update public.pines set expira_en = now() - interval '1 day' where id = (select valor::uuid from guardado where clave = 'rojo');
select private.aplicar_reglas_de_tiempo();
insert into resultados (prueba, resultado) select 'a las 72 h pasa a caducado', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'rojo');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin
  perform public.renovar_pin((select valor::uuid from guardado where clave = 'rojo'));
  insert into resultados (prueba, resultado) values ('solo el autor renueva', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('solo el autor renueva', 'sí: ' || sqlerrm);
end $$;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.renovar_pin((select valor::uuid from guardado where clave = 'rojo'));
insert into resultados (prueba, resultado) select 'renovado: activo 72 h más', estado::text || ' / ' || renovado || ' / ' || (expira_en > now() + interval '71 hours') from public.pines where id = (select valor::uuid from guardado where clave = 'rojo');
reset role;
update public.pines set expira_en = now() - interval '1 day', estado = 'caducado' where id = (select valor::uuid from guardado where clave = 'rojo');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin
  perform public.renovar_pin((select valor::uuid from guardado where clave = 'rojo'));
  insert into resultados (prueba, resultado) values ('solo se renueva una vez', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('solo se renueva una vez', 'sí: ' || sqlerrm);
end $$;

-- ─── "Lo encontré" en "Se busca" (caducado, dentro de 30 días) ───
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into guardado select 'de_se_busca', public.lo_encontre((select valor::uuid from guardado where clave = 'rojo'), '', '', 'Llavero de Pumas')::text;
insert into resultados (prueba, resultado) select '"Lo encontré" en un pin de "Se busca"', (pin_vinculado_id = (select valor::uuid from guardado where clave = 'rojo'))::text from public.pines where id = (select valor::uuid from guardado where clave = 'de_se_busca');
reset role;
update public.pines set expira_en = now() - interval '31 days' where id = (select valor::uuid from guardado where clave = 'rojo');
set local role authenticated;
do $$ begin
  perform public.lo_encontre((select valor::uuid from guardado where clave = 'rojo'), '', '', 'Otro dato');
  insert into resultados (prueba, resultado) values ('después de 30 días ya no', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('después de 30 días ya no', 'sí: ' || sqlerrm);
end $$;

-- ─── Reglas de tiempo: 24 h en camino y 72 h aceptado ───
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into guardado select 'camino', public.crear_pin('verde', 'ropa', 'Sudadera', 'Gris', 'edificio-K', '', 4, 4, 'Bordado del Tec')::text;
select public.dejar_en_punto_seguro((select valor::uuid from guardado where clave = 'camino'), (select valor::uuid from guardado where clave = 'punto'));
insert into guardado select 'aceptado', public.crear_pin('verde', 'termos', 'Termo', 'Azul', 'edificio-K', '', 5, 5, 'Calcomanía')::text;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into guardado select 'sol_vieja', public.solicitar_pin((select valor::uuid from guardado where clave = 'aceptado'), 'Calcomanía')::text;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.responder_solicitud((select valor::uuid from guardado where clave = 'sol_vieja'), 'aceptar');
do $$ begin
  perform public.dejar_en_punto_seguro((select valor::uuid from guardado where clave = 'aceptado'), (select valor::uuid from guardado where clave = 'punto'));
  insert into resultados (prueba, resultado) values ('con entrega en curso no se lleva al punto', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('con entrega en curso no se lleva al punto', 'sí: ' || sqlerrm);
end $$;
reset role;
update public.pines set en_camino_desde = now() - interval '25 hours' where id = (select valor::uuid from guardado where clave = 'camino');
update public.solicitudes set aceptada_en = now() - interval '73 hours' where id = (select valor::uuid from guardado where clave = 'sol_vieja');
select private.aplicar_reglas_de_tiempo();
select private.aplicar_reglas_de_tiempo(); -- dos veces: el aviso de 24 h no se repite
insert into resultados (prueba, resultado) select '24 h: aviso a Ana una vez (1) y sigue en_camino', count(*)::text || ' / ' || (select estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'camino'))
from public.avisos where tipo = 'punto_seguro_sin_confirmar' and destinatario_id = '11111111-1111-1111-1111-111111111111';
insert into resultados (prueba, resultado) select '72 h aceptado: solicitud cancelada', estado::text from public.solicitudes where id = (select valor::uuid from guardado where clave = 'sol_vieja');
insert into resultados (prueba, resultado) select '72 h aceptado: pin vuelve a activo', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'aceptado');

-- ─── Admin regresa a activo un objeto en camino; Ana no puede ───
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin
  perform public.regresar_a_activo((select valor::uuid from guardado where clave = 'camino'));
  insert into resultados (prueba, resultado) values ('solo el admin regresa a activo', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('solo el admin regresa a activo', 'sí: ' || sqlerrm);
end $$;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select public.regresar_a_activo((select valor::uuid from guardado where clave = 'camino'));
insert into resultados (prueba, resultado) select 'admin: en_camino → activo', estado::text || ' / ' || coalesce(punto_seguro_id::text, 'sin punto') from public.pines where id = (select valor::uuid from guardado where clave = 'camino');

-- ─── No reclamado: solo al terminar el semestre en que se recibió ───
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into guardado select 'olvidado', public.crear_pin('verde', 'utiles', 'Cuaderno', 'Azul', 'edificio-K', '', 6, 6, 'Nombre en la portada')::text;
select public.dejar_en_punto_seguro((select valor::uuid from guardado where clave = 'olvidado'), (select valor::uuid from guardado where clave = 'punto'));
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select public.confirmar_recepcion((select valor::uuid from guardado where clave = 'olvidado'));
do $$ begin
  perform public.marcar_no_reclamado((select valor::uuid from guardado where clave = 'olvidado'));
  insert into resultados (prueba, resultado) values ('no se marca antes de fin de semestre', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('no se marca antes de fin de semestre', 'sí: ' || sqlerrm);
end $$;
reset role;
-- Simula que se recibió en un semestre que ya terminó
insert into public.semestres (nombre, fecha_inicio, fecha_fin) values ('Prueba Enero–Junio 2026', '2026-01-15', '2026-06-30');
update public.pines set en_resguardo_desde = '2026-05-10' where id = (select valor::uuid from guardado where clave = 'olvidado');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select public.marcar_no_reclamado((select valor::uuid from guardado where clave = 'olvidado'));
insert into resultados (prueba, resultado) select 'en_resguardo → no_reclamado', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'olvidado');

-- ─── Historial para la cadena de Markov ───
reset role;
insert into resultados (prueba, resultado) select 'historial del objeto entregado', string_agg(coalesce(estado_anterior::text, '∅') || '→' || estado_nuevo, ', ' order by id)
from public.historial_estados where pin_id = (select valor::uuid from guardado where clave = 'verde');

select prueba, resultado from resultados order by n;
rollback;
