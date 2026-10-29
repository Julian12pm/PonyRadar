-- ════════════════════════════════════════════════════════════════════════════
-- 0011 · Moderación
--   1. Una cuenta por buzón: el correo se normaliza quitando el "+alias"
--      (l23121064+sec@… → l23121064@…). Solo se puede registrar un alias si el admin lo
--      autorizó (tabla alias_permitidos). Las cuentas con alias que ya existían no se borran:
--      el panel de admin las marca.
--   2. El admin puede eliminar un pin (con motivo); queda registro en "moderacion".
--   3. Títulos de pin: de 3 a 60 caracteres y con al menos una letra.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Una cuenta por buzón ────────────────────────────────────────────────

-- Buzón real: sin el "+alias" de la parte antes de la @ (misma regla que src/lib/correo.js)
create or replace function private.buzon(correo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(trim(correo)), '^([^@+]*)\+[^@]*@', '\1@');
$$;

create table public.alias_permitidos (
  correo text primary key check (correo = lower(trim(correo)) and correo like '%+%@morelia.tecnm.mx'),
  nota text not null default '' check (char_length(nota) <= 120),
  creado_en timestamptz not null default now()
);
comment on table public.alias_permitidos is
  'Correos con "+alias" que el admin autorizó a tener cuenta propia (ej. cuentas de prueba).';
alter table public.alias_permitidos enable row level security;
create policy "admin ve los alias permitidos" on public.alias_permitidos
  for select to authenticated using ((select private.es_admin()));
create policy "admin agrega alias permitidos" on public.alias_permitidos
  for insert to authenticated with check ((select private.es_admin()));
create policy "admin quita alias permitidos" on public.alias_permitidos
  for delete to authenticated using ((select private.es_admin()));
revoke all on public.alias_permitidos from anon;
grant select, insert, delete on public.alias_permitidos to authenticated;

-- La cuenta de admin de prueba del dueño de la beta sigue funcionando
insert into public.alias_permitidos (correo, nota)
values ('l23121115+admin@morelia.tecnm.mx', 'Cuenta admin del dueño de la beta');

/**
 * Por qué no se puede crear una cuenta con este correo, o null si sí se puede.
 * La usan el hook "Before User Created" y el trigger que crea el perfil.
 */
create or replace function private.motivo_rechazo_cuenta(correo text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_correo text := lower(trim(correo));
  v_autorizado boolean := exists (select 1 from public.alias_permitidos a where a.correo = v_correo);
begin
  if not private.correo_permitido(v_correo) then
    return 'Solo se aceptan correos @morelia.tecnm.mx';
  end if;
  if v_correo <> private.buzon(v_correo) and not v_autorizado then
    return 'Usa tu correo institucional sin "+": solo se permite una cuenta por persona';
  end if;
  -- Otra cuenta del mismo buzón (sin contar los alias autorizados)
  if not v_autorizado and exists (
    select 1 from public.perfiles p
    where private.buzon(p.correo) = private.buzon(v_correo)
      and p.correo <> v_correo
      and not exists (select 1 from public.alias_permitidos a where a.correo = p.correo)
  ) then
    return 'Ya existe una cuenta con este correo institucional';
  end if;
  return null;
end;
$$;
revoke execute on function private.motivo_rechazo_cuenta(text) from public, anon, authenticated;
grant execute on function private.motivo_rechazo_cuenta(text) to supabase_auth_admin;

-- Hook "Before User Created": mismo nombre que antes, así no hay que cambiar el panel
create or replace function public.hook_solo_correo_institucional(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_motivo text := private.motivo_rechazo_cuenta(event -> 'user' ->> 'email');
begin
  if v_motivo is null then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', v_motivo));
end;
$$;

-- Segunda barrera: el trigger que crea el perfil
create or replace function private.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := private.motivo_rechazo_cuenta(new.email);
begin
  if v_motivo is not null then
    raise exception '%', v_motivo;
  end if;
  insert into public.perfiles (id, correo, nombre)
  values (new.id, lower(new.email), split_part(new.email, '@', 1));
  return new;
end;
$$;

-- ─── 2. Eliminar un pin (admin) ─────────────────────────────────────────────

create table public.moderacion (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.perfiles (id),
  accion text not null,
  pin_id uuid not null, -- sin llave foránea: el pin ya no existe
  titulo text not null,
  tipo public.tipo_pin not null,
  autor_id uuid references public.perfiles (id) on delete set null,
  motivo text not null check (char_length(motivo) between 3 and 300),
  creado_en timestamptz not null default now()
);
create index moderacion_autor_idx on public.moderacion (autor_id);
create index moderacion_admin_idx on public.moderacion (admin_id);
alter table public.moderacion enable row level security;
create policy "admin ve la moderación" on public.moderacion
  for select to authenticated using ((select private.es_admin()));
revoke all on public.moderacion from anon;
revoke insert, update, delete on public.moderacion from authenticated;

/**
 * Elimina un pin (con sus solicitudes, avisos y dato ciego) y deja registro del motivo.
 * Un pin verde vinculado a este rojo se queda, pero sin vínculo. Las fotos las borra la app
 * con la política de Storage de abajo.
 */
create or replace function public.admin_eliminar_pin(p_pin uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.pines;
begin
  if not private.es_admin() then
    raise exception 'Solo un admin puede eliminar pines';
  end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escribe el motivo (al menos 3 caracteres)';
  end if;
  select * into v_pin from public.pines where id = p_pin for update;
  if not found then
    raise exception 'Ese pin ya no existe';
  end if;
  insert into public.moderacion (admin_id, accion, pin_id, titulo, tipo, autor_id, motivo)
  values ((select auth.uid()), 'eliminar_pin', v_pin.id, v_pin.titulo, v_pin.tipo, v_pin.autor_id, trim(p_motivo));
  delete from public.pines where id = p_pin;
end;
$$;
revoke execute on function public.admin_eliminar_pin(uuid, text) from public, anon;
grant execute on function public.admin_eliminar_pin(uuid, text) to authenticated;

create policy "admin borra fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and (select private.es_admin()));

-- ─── 3. Títulos con letras ──────────────────────────────────────────────────

-- De 3 a 60 caracteres y al menos una letra (misma regla que src/lib/validacion.js)
create or replace function private.titulo_valido(titulo text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(trim(coalesce(titulo, ''))) between 3 and 60
     and trim(titulo) ~ '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]';
$$;

-- Para pines nuevos o editados ("not valid": no revisa los que ya existen)
alter table public.pines
  add constraint pines_titulo_con_letras check (private.titulo_valido(titulo)) not valid;

create or replace function public.crear_pin(
  p_tipo public.tipo_pin,
  p_categoria public.categoria_objeto,
  p_titulo text,
  p_descripcion text,
  p_zona_id text,
  p_piso text,
  p_x real,
  p_y real,
  p_dato_ciego text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_pin uuid;
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  if not private.puede_publicar(v_usuario) then
    raise exception 'Tu cuenta está suspendida: puedes ver el mapa, pero no crear pines';
  end if;
  if not private.titulo_valido(p_titulo) then
    raise exception 'El título debe tener entre 3 y 60 caracteres y al menos una letra';
  end if;
  if p_tipo = 'verde' and char_length(trim(coalesce(p_dato_ciego, ''))) < 3 then
    raise exception 'El pin verde necesita un dato ciego (algo que solo el dueño sabría)';
  end if;
  if p_tipo = 'rojo' and p_dato_ciego is not null then
    raise exception 'Solo los pines verdes llevan dato ciego';
  end if;
  -- El croquis mide unos 620 × 610 m alrededor del origen
  if abs(p_x) > 400 or abs(p_y) > 400 then
    raise exception 'La posición está fuera del mapa';
  end if;

  insert into public.pines (autor_id, tipo, categoria, titulo, descripcion, zona_id, piso, x, y)
  values (
    v_usuario, p_tipo, p_categoria, trim(p_titulo), trim(coalesce(p_descripcion, '')),
    p_zona_id, trim(coalesce(p_piso, '')), p_x, p_y
  )
  returning id into v_pin;

  if p_tipo = 'verde' then
    insert into public.datos_ciegos (pin_id, dato) values (v_pin, trim(p_dato_ciego));
  end if;

  return v_pin;
end;
$$;
-- "Lo encontré" (lo_encontre) crea su pin con crear_pin, así que también valida el título.
