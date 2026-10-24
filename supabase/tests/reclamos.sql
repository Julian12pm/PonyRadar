-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de reclamos y entrega (migración 0006).
-- Tres usuarios de prueba: Ana encuentra un termo, Beto es el dueño y Carla intenta
-- reclamarlo también. Todo ocurre dentro de una transacción que termina en ROLLBACK.
-- Cada fila del resultado debe decir "sí…", "true" o el valor esperado entre paréntesis.
--
-- Cómo correrlo: pegarlo completo en Supabase → SQL Editor (o con el MCP execute_sql).
-- ════════════════════════════════════════════════════════════════════════════

begin;
create temp table resultados (n serial, prueba text, resultado text) on commit drop;
create temp table guardado (clave text, valor text) on commit drop;
grant all on resultados, guardado to authenticated, anon;
grant usage on sequence resultados_n_seq to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.prueba@morelia.tecnm.mx'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto.prueba@morelia.tecnm.mx'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla.prueba@morelia.tecnm.mx');

set local role authenticated;

-- ─── Ana publica un pin verde; Beto deja un pin rojo de la misma categoría y zona ───
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into guardado select 'rojo', public.crear_pin('rojo', 'termos', 'Mi termo', 'Termo azul', 'edificio-K', '', 10, 20, null)::text;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into guardado select 'verde', public.crear_pin('verde', 'termos', 'Termo azul', 'Termo', 'edificio-K', '', 12, 22, 'Calcomanía de Pumas')::text;

do $$ begin
  perform public.solicitar_pin((select valor::uuid from guardado where clave = 'verde'), 'es mío');
  insert into resultados (prueba, resultado) values ('Ana no reclama su propio pin', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('Ana no reclama su propio pin', 'sí: ' || sqlerrm);
end $$;

-- ─── Beto: aviso de coincidencia y "Es mío" ───
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Beto recibe aviso de coincidencia (1)', count(*)::text from public.avisos where tipo = 'coincidencia';
insert into guardado select 'sol_beto', public.solicitar_pin((select valor::uuid from guardado where clave = 'verde'), 'Calcomanía de Pumas')::text;
insert into resultados (prueba, resultado) select 'pin pasa a con_solicitud', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'verde');
do $$ begin
  perform public.solicitar_pin((select valor::uuid from guardado where clave = 'verde'), 'otra vez');
  insert into resultados (prueba, resultado) values ('no hay doble solicitud pendiente', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('no hay doble solicitud pendiente', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  perform clave_hash from public.solicitudes;
  insert into resultados (prueba, resultado) values ('clave_hash no se puede leer', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('clave_hash no se puede leer', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  perform public.responder_solicitud((select valor::uuid from guardado where clave = 'sol_beto'), 'aceptar');
  insert into resultados (prueba, resultado) values ('Beto no acepta su propia solicitud', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('Beto no acepta su propia solicitud', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  perform * from public.contacto_del_caso((select valor::uuid from guardado where clave = 'sol_beto'));
  insert into resultados (prueba, resultado) values ('sin aceptar no hay contacto', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('sin aceptar no hay contacto', 'sí: ' || sqlerrm);
end $$;
insert into resultados (prueba, resultado) select 'Beto aún no ve la foto nítida', (not private.puede_ver_foto_nitida((select valor from guardado where clave = 'verde') || '/nitida.webp'))::text;

-- ─── Carla también lo reclama ───
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into guardado select 'sol_carla', public.solicitar_pin((select valor::uuid from guardado where clave = 'verde'), 'Es rojo con flores')::text;
insert into resultados (prueba, resultado) select 'Carla solo ve su solicitud (1)', count(*)::text from public.solicitudes;

-- ─── Ana ve las dos, avisos, y acepta a Beto ───
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Ana ve 2 solicitudes (2)', count(*)::text from public.solicitudes;
insert into resultados (prueba, resultado) select 'Ana tiene 2 avisos de reclamo (2)', count(*)::text from public.avisos where tipo = 'reclamaron_mi_objeto';
select public.responder_solicitud((select valor::uuid from guardado where clave = 'sol_beto'), 'aceptar');
insert into resultados (prueba, resultado) select 'pin pasa a aceptado', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'verde');
insert into resultados (prueba, resultado) select 'la de Carla se cancela', estado::text from public.solicitudes where id = (select valor::uuid from guardado where clave = 'sol_carla');
insert into resultados (prueba, resultado) select 'contacto para Ana (beto.prueba@…)', correo || ' / ' || papel from public.contacto_del_caso((select valor::uuid from guardado where clave = 'sol_beto'));
do $$ begin
  perform public.generar_clave((select valor::uuid from guardado where clave = 'sol_beto'));
  insert into resultados (prueba, resultado) values ('Ana no puede ver la clave', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('Ana no puede ver la clave', 'sí: ' || sqlerrm);
end $$;
do $$ begin
  perform public.verificar_clave((select valor::uuid from guardado where clave = 'sol_beto'), '0000');
  insert into resultados (prueba, resultado) values ('sin clave generada no se verifica', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('sin clave generada no se verifica', 'sí: ' || sqlerrm);
end $$;

-- ─── Carla ya no participa ───
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Carla recibe aviso de no aceptada (1)', count(*)::text from public.avisos where tipo = 'solicitud_rechazada';
do $$ begin
  perform * from public.contacto_del_caso((select valor::uuid from guardado where clave = 'sol_beto'));
  insert into resultados (prueba, resultado) values ('Carla no ve el contacto de otros', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('Carla no ve el contacto de otros', 'sí: ' || sqlerrm);
end $$;

-- ─── Beto: contacto, foto nítida y clave ───
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'contacto para Beto (ana.prueba@…)', correo || ' / ' || papel from public.contacto_del_caso((select valor::uuid from guardado where clave = 'sol_beto'));
insert into resultados (prueba, resultado) select 'Beto aceptado ve la foto nítida', private.puede_ver_foto_nitida((select valor from guardado where clave = 'verde') || '/nitida.webp')::text;
insert into resultados (prueba, resultado) select 'Beto sigue sin ver el dato ciego (0)', count(*)::text from public.datos_ciegos;
insert into guardado select 'clave', public.generar_clave((select valor::uuid from guardado where clave = 'sol_beto'));
insert into resultados (prueba, resultado) select 'la clave son 4 dígitos', (valor ~ '^[0-9]{4}$')::text from guardado where clave = 'clave';

-- ─── Ana escribe la clave: 4 fallos y luego la correcta ───
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into guardado select 'incorrecta', lpad(((valor::int + 1) % 10000)::text, 4, '0') from guardado where clave = 'clave';
select public.verificar_clave((select valor::uuid from guardado where clave = 'sol_beto'), (select valor from guardado where clave = 'incorrecta')) from generate_series(1, 3);
insert into resultados (prueba, resultado) select '4.º fallo: queda 1 intento', public.verificar_clave((select valor::uuid from guardado where clave = 'sol_beto'), (select valor from guardado where clave = 'incorrecta'))::text;
insert into resultados (prueba, resultado) select 'clave correcta entrega', public.verificar_clave((select valor::uuid from guardado where clave = 'sol_beto'), (select valor from guardado where clave = 'clave'))::text;
insert into resultados (prueba, resultado) select 'pin verde entregado', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'verde');

-- ─── Impostor: Carla reclama otro pin de Ana y recibe un strike ───
insert into guardado select 'verde2', public.crear_pin('verde', 'llaves', 'Llavero', 'Llavero', 'edificio-K', '', 5, 5, 'Llave con tapa morada')::text;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into guardado select 'sol_carla2', public.solicitar_pin((select valor::uuid from guardado where clave = 'verde2'), 'Tiene un llavero de Hello Kitty')::text;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.responder_solicitud((select valor::uuid from guardado where clave = 'sol_carla2'), 'impostor');
insert into resultados (prueba, resultado) select 'pin vuelve a activo', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'verde2');
do $$ begin
  insert into public.strikes (perfil_id, solicitud_id) values ('33333333-3333-3333-3333-333333333333', (select valor::uuid from guardado where clave = 'sol_carla2'));
  insert into resultados (prueba, resultado) values ('nadie da strikes directo', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('nadie da strikes directo', 'sí: ' || sqlerrm);
end $$;
insert into resultados (prueba, resultado) select 'Ana no ve strikes ajenos (0)', count(*)::text from public.strikes;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Carla ve su strike (1)', count(*)::text from public.strikes;

-- ─── 5 fallos cancelan la entrega ───
insert into guardado select 'sol_carla3', public.solicitar_pin((select valor::uuid from guardado where clave = 'verde2'), 'Llave con tapa morada')::text;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.responder_solicitud((select valor::uuid from guardado where clave = 'sol_carla3'), 'aceptar');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into guardado select 'clave3', public.generar_clave((select valor::uuid from guardado where clave = 'sol_carla3'));
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.verificar_clave((select valor::uuid from guardado where clave = 'sol_carla3'), lpad(((select valor::int from guardado where clave = 'clave3') + 1) % 10000 || '', 4, '0')) from generate_series(1, 5);
insert into resultados (prueba, resultado) select 'tras 5 fallos la solicitud se cancela', estado::text || ' / ' || intentos_clave from public.solicitudes where id = (select valor::uuid from guardado where clave = 'sol_carla3');
insert into resultados (prueba, resultado) select 'y el pin vuelve a activo', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'verde2');

-- ─── "Lo encontré": Carla encontró el termo rojo de Beto ───
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into guardado select 'vinculado', public.lo_encontre((select valor::uuid from guardado where clave = 'rojo'), '', '', 'Tiene una abolladura abajo')::text;
insert into resultados (prueba, resultado) select 'pin verde vinculado al rojo', (pin_vinculado_id = (select valor::uuid from guardado where clave = 'rojo'))::text from public.pines where id = (select valor::uuid from guardado where clave = 'vinculado');
do $$ begin
  perform public.lo_encontre((select valor::uuid from guardado where clave = 'verde2'), '', '', 'algo');
  insert into resultados (prueba, resultado) values ('"Lo encontré" solo en pines rojos', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('"Lo encontré" solo en pines rojos', 'sí: ' || sqlerrm);
end $$;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into resultados (prueba, resultado) select 'Beto: aviso "lo encontraron" y sin coincidencia repetida', string_agg(tipo::text, ', ' order by tipo) from public.avisos where pin_id = (select valor::uuid from guardado where clave = 'vinculado');

-- ─── Al entregar el pin vinculado, el rojo de Beto también se cierra ───
insert into guardado select 'sol_beto2', public.solicitar_pin((select valor::uuid from guardado where clave = 'vinculado'), 'Tiene una abolladura abajo')::text;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select public.responder_solicitud((select valor::uuid from guardado where clave = 'sol_beto2'), 'aceptar');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into guardado select 'clave4', public.generar_clave((select valor::uuid from guardado where clave = 'sol_beto2'));
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select public.verificar_clave((select valor::uuid from guardado where clave = 'sol_beto2'), (select valor from guardado where clave = 'clave4'));
insert into resultados (prueba, resultado) select 'el rojo de Beto queda entregado', estado::text from public.pines where id = (select valor::uuid from guardado where clave = 'rojo');

-- ─── Sin sesión no hay RPC ───
reset role;
set local role anon;
do $$ begin
  perform public.solicitar_pin(gen_random_uuid(), 'algo');
  insert into resultados (prueba, resultado) values ('anon no reclama', 'NO');
exception when others then insert into resultados (prueba, resultado) values ('anon no reclama', 'sí: ' || sqlerrm);
end $$;
reset role;

select prueba, resultado from resultados order by n;
rollback;
