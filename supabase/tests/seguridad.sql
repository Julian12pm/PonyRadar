-- ════════════════════════════════════════════════════════════════════════════
-- Pruebas de seguridad de la base de datos (RLS, permisos y funciones RPC).
-- Crea dos usuarios de prueba (Ana y Beto) DENTRO de una transacción que termina en
-- ROLLBACK: no deja nada guardado. Cada fila del resultado debe decir "sí…", "true"
-- o el número esperado.
--
-- Cómo correrlo: pegarlo completo en Supabase → SQL Editor (o con el MCP execute_sql).
-- ════════════════════════════════════════════════════════════════════════════

begin;
create temp table resultados (prueba text, resultado text) on commit drop;
grant all on resultados to authenticated, anon;

-- 1. Un correo que no es institucional no puede crear usuario
do $$ begin
  insert into auth.users (id, instance_id, aud, role, email) values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alguien@gmail.com');
  insert into resultados values ('gmail bloqueado', 'NO (se creó)');
exception when others then insert into resultados values ('gmail bloqueado', 'sí: ' || sqlerrm);
end $$;

-- 2. Dos usuarios institucionales: se crea su perfil automáticamente (esperado: 2)
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.prueba@morelia.tecnm.mx'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto.prueba@morelia.tecnm.mx');
insert into resultados select 'perfiles creados', count(*)::text from public.perfiles where correo like '%.prueba@%';

-- 3. Como Ana
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

do $$ begin
  perform public.crear_pin('verde', 'llaves', 'Llavero', 'Llavero con 3 llaves', 'edificio-K', '', 10, 20, null);
  insert into resultados values ('verde sin dato ciego rechazado', 'NO');
exception when others then insert into resultados values ('verde sin dato ciego rechazado', 'sí: ' || sqlerrm);
end $$;

insert into resultados select 'verde con dato ciego creado', public.crear_pin('verde', 'llaves', 'Llavero', 'Llavero con 3 llaves', 'edificio-K', '2.º piso', 10, 20, 'Tiene una llave con tapa morada')::text;
insert into resultados select 'Ana ve su dato ciego (1)', count(*)::text from public.datos_ciegos;
insert into resultados select 'Ana ve pines (1)', count(*)::text from public.pines;

do $$ begin
  insert into public.pines (autor_id, tipo, categoria, titulo, zona_id, x, y) values ('11111111-1111-1111-1111-111111111111', 'rojo', 'otros', 'Directo', 'edificio-K', 0, 0);
  insert into resultados values ('insert directo bloqueado', 'NO');
exception when others then insert into resultados values ('insert directo bloqueado', 'sí: ' || sqlerrm);
end $$;

do $$ begin
  update public.perfiles set rol = 'admin' where id = '11111111-1111-1111-1111-111111111111';
  insert into resultados values ('no puede volverse admin', 'NO');
exception when others then insert into resultados values ('no puede volverse admin', 'sí: ' || sqlerrm);
end $$;

update public.perfiles set nombre = 'Ana P.' where id = '11111111-1111-1111-1111-111111111111';
insert into resultados select 'Ana cambia su nombre (Ana P.)', nombre from public.perfiles where id = '11111111-1111-1111-1111-111111111111';

-- 4. Como Beto
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into resultados select 'Beto ve el pin de Ana (1)', count(*)::text from public.pines;
insert into resultados select 'Beto NO ve el dato ciego (0)', count(*)::text from public.datos_ciegos;
insert into resultados select 'Beto ve perfiles, solo el suyo (1)', count(*)::text from public.perfiles;
do $$ begin
  perform public.adjuntar_fotos((select id from public.pines limit 1));
  insert into resultados values ('Beto no adjunta fotos ajenas', 'NO');
exception when others then insert into resultados values ('Beto no adjunta fotos ajenas', 'sí: ' || sqlerrm);
end $$;
insert into resultados select 'Beto no puede subir foto al pin de Ana', (not private.puede_subir_foto((select id from public.pines limit 1)::text || '/publica.webp'))::text;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into resultados select 'Ana sí puede subir foto nítida a su verde', private.puede_subir_foto((select id from public.pines limit 1)::text || '/nitida.webp')::text;
insert into resultados select 'ruta rara rechazada', (not private.puede_subir_foto('../x/publica.webp'))::text;

-- 5. Sin sesión (anon)
reset role;
set local role anon;
do $$ begin
  perform count(*) from public.pines;
  insert into resultados values ('anon no lee pines', 'NO');
exception when others then insert into resultados values ('anon no lee pines', 'sí: ' || sqlerrm);
end $$;
reset role;

select * from resultados;
rollback;
