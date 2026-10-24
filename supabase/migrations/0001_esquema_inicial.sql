-- ════════════════════════════════════════════════════════════════════════════
-- 0001 · Esquema inicial de PonyRadar
-- Perfiles y roles, pines, datos ciegos, solicitudes, avisos, puntos seguros,
-- semestres e historial de estados (para la cadena de Markov).
--
-- Reglas de seguridad:
--   · RLS activado en TODAS las tablas.
--   · El cliente casi no escribe directo: las acciones sensibles se hacen con
--     funciones RPC "security definer" (ver 0003 y fases siguientes).
--   · Las funciones auxiliares de las políticas viven en el esquema "private",
--     que NO se expone por la API.
-- ════════════════════════════════════════════════════════════════════════════

create schema if not exists private;
revoke all on schema private from public;
-- Las políticas RLS se evalúan con el rol de quien consulta, así que necesita poder usar el esquema
grant usage on schema private to authenticated;

-- ─── Tipos ──────────────────────────────────────────────────────────────────

create type public.rol_usuario as enum ('comunidad', 'punto_seguro', 'admin');
create type public.tipo_pin as enum ('rojo', 'verde');
create type public.categoria_objeto as enum (
  'electronicos', 'credenciales', 'llaves', 'ropa', 'mochilas', 'utiles', 'termos', 'otros'
);
-- Estados del objeto: exactamente los de la especificación (sección 7)
create type public.estado_objeto as enum (
  'activo', 'con_solicitud', 'aceptado', 'entregado',
  'en_camino', 'en_resguardo', 'no_reclamado', 'caducado'
);
create type public.estado_solicitud as enum (
  'pendiente', 'aceptada', 'rechazada', 'impostor', 'cancelada'
);
create type public.tipo_aviso as enum (
  'reclamaron_mi_objeto',      -- alguien pulsó "Es mío" en mi pin verde
  'solicitud_aceptada',
  'solicitud_rechazada',
  'lo_encontraron',            -- alguien pulsó "Lo encontré" en mi pin rojo
  'coincidencia',              -- pin verde de la misma categoría y zona que mi rojo
  'punto_seguro_sin_confirmar' -- un punto seguro no confirmó mi objeto en 24 h
);

-- ─── Correo institucional ───────────────────────────────────────────────────

-- Misma regla que src/lib/correo.js: solo cuentas @morelia.tecnm.mx
create or replace function private.correo_permitido(correo text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(lower(trim(correo)) ~ '^[^\s@]+@morelia\.tecnm\.mx$', false);
$$;

-- ─── Perfiles ───────────────────────────────────────────────────────────────

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text not null unique check (private.correo_permitido(correo)),
  nombre text not null check (char_length(nombre) between 1 and 80),
  rol public.rol_usuario not null default 'comunidad',
  -- Suspensión por strikes (Fase 4): mientras sea futura, no puede crear pines ni solicitudes
  suspendido_hasta timestamptz,
  bloqueado boolean not null default false, -- 5+ strikes: hasta revisión del admin
  creado_en timestamptz not null default now()
);
comment on table public.perfiles is 'Un perfil por usuario de Auth. El rol solo lo cambia el admin.';

-- Al crearse un usuario en Auth se crea su perfil. Si el correo no es institucional, se rechaza
-- (segunda barrera además del hook "Before User Created").
create or replace function private.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.correo_permitido(new.email) then
    raise exception 'Solo se aceptan correos @morelia.tecnm.mx';
  end if;
  insert into public.perfiles (id, correo, nombre)
  values (new.id, lower(new.email), split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function private.crear_perfil();

-- Hook "Before User Created" de Supabase Auth: rechaza el registro con un mensaje claro.
-- Se activa en el panel: Authentication → Hooks → Before User Created → esta función.
create or replace function public.hook_solo_correo_institucional(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if private.correo_permitido(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Solo se aceptan correos @morelia.tecnm.mx'
    )
  );
end;
$$;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.correo_permitido(text) to supabase_auth_admin;
grant execute on function public.hook_solo_correo_institucional(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_solo_correo_institucional(jsonb) from authenticated, anon, public;

-- Funciones auxiliares para las políticas (consultan perfiles sin pasar por su RLS)
create or replace function private.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles where id = (select auth.uid()) and rol = 'admin'
  );
$$;
revoke execute on function private.es_admin() from public, anon;
grant execute on function private.es_admin() to authenticated;

alter table public.perfiles enable row level security;

-- Cada quien ve su propio perfil; el admin ve todos.
-- (El nombre y correo de otra persona solo se muestran en la tarjeta de contacto tras aceptar
--  una solicitud; eso se resuelve con una función RPC en la Fase 3.)
create policy "ver mi perfil" on public.perfiles
  for select to authenticated
  using ((select auth.uid()) = id or (select private.es_admin()));

-- Solo puede cambiar su propio nombre (ver permisos por columna al final del archivo).
-- El rol, la suspensión y el bloqueo los cambia el admin con funciones RPC (Fase 5).
create policy "editar mi perfil" on public.perfiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ─── Zonas del mapa (se llenan en 0002 a partir de src/mapa/zonas.js) ───────

create table public.zonas (
  id text primary key, -- edificio-K, estacionamiento-5, jardin-unidad-central…
  tipo text not null check (tipo in ('edificio', 'exterior')),
  nombre text not null,
  unidad text not null check (
    unidad in ('unidad-central', 'unidad-metal-mecanica', 'unidad-posgrado')
  )
);
alter table public.zonas enable row level security;
create policy "zonas visibles" on public.zonas for select to authenticated using (true);

-- ─── Puntos seguros ─────────────────────────────────────────────────────────

create table public.puntos_seguros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  zona_id text not null references public.zonas (id),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Personal asignado a cada punto seguro (lo asigna el admin)
create table public.personal_punto_seguro (
  punto_id uuid not null references public.puntos_seguros (id) on delete cascade,
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  primary key (punto_id, perfil_id)
);
create index personal_punto_seguro_perfil_idx on public.personal_punto_seguro (perfil_id);

alter table public.puntos_seguros enable row level security;
alter table public.personal_punto_seguro enable row level security;

create policy "puntos seguros visibles" on public.puntos_seguros
  for select to authenticated using (true);
create policy "admin administra puntos seguros" on public.puntos_seguros
  for all to authenticated
  using ((select private.es_admin()))
  with check ((select private.es_admin()));

create policy "ver mi asignación o admin" on public.personal_punto_seguro
  for select to authenticated
  using ((select auth.uid()) = perfil_id or (select private.es_admin()));
create policy "admin asigna personal" on public.personal_punto_seguro
  for all to authenticated
  using ((select private.es_admin()))
  with check ((select private.es_admin()));

-- ─── Pines ──────────────────────────────────────────────────────────────────

create table public.pines (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.perfiles (id) on delete cascade,
  tipo public.tipo_pin not null,
  categoria public.categoria_objeto not null,
  titulo text not null check (char_length(titulo) between 3 and 60),
  descripcion text not null default '' check (char_length(descripcion) <= 280),
  zona_id text not null references public.zonas (id),
  piso text not null default '' check (char_length(piso) <= 30),
  -- Posición en el croquis, en metros (mismo sistema que src/mapa/campus-osm.json)
  x real not null,
  y real not null,
  estado public.estado_objeto not null default 'activo',
  creado_en timestamptz not null default now(),
  -- Caducidad: se ve en el mapa 72 h; las consultas filtran por expira_en
  expira_en timestamptz not null default now() + interval '72 hours',
  renovado boolean not null default false, -- un pin rojo se puede renovar una sola vez
  foto_publica text,                        -- ruta en Storage (desenfocada si es verde)
  tiene_foto_nitida boolean not null default false,
  punto_seguro_id uuid references public.puntos_seguros (id),
  pin_vinculado_id uuid references public.pines (id) on delete set null -- "Lo encontré"
);
create index pines_autor_idx on public.pines (autor_id);
create index pines_zona_idx on public.pines (zona_id);
create index pines_punto_seguro_idx on public.pines (punto_seguro_id);
create index pines_vinculado_idx on public.pines (pin_vinculado_id);
-- Consulta principal del mapa: pines visibles que no han caducado
create index pines_mapa_idx on public.pines (expira_en) where estado in ('activo', 'con_solicitud', 'aceptado');

alter table public.pines enable row level security;

-- Todos los usuarios (solo existen cuentas institucionales) ven los datos públicos de los pines.
-- El dato ciego y la foto nítida están en otra tabla / ruta con su propia política.
create policy "pines visibles para la comunidad" on public.pines
  for select to authenticated using (true);
-- No hay políticas de insert/update/delete: los pines se crean y cambian solo con funciones RPC.

-- ─── Datos ciegos (solo pines verdes) ───────────────────────────────────────

create table public.datos_ciegos (
  pin_id uuid primary key references public.pines (id) on delete cascade,
  dato text not null check (char_length(dato) between 3 and 200),
  creado_en timestamptz not null default now()
);
comment on table public.datos_ciegos is
  'Lo que identifica al objeto. Solo lo lee quien encontró el objeto (y en la Fase 4, el punto seguro que lo resguarda).';

create or replace function private.es_autor_pin(pin uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pines where id = pin and autor_id = (select auth.uid())
  );
$$;
revoke execute on function private.es_autor_pin(uuid) from public, anon;
grant execute on function private.es_autor_pin(uuid) to authenticated;

alter table public.datos_ciegos enable row level security;
create policy "solo el autor lee el dato ciego" on public.datos_ciegos
  for select to authenticated
  using ((select private.es_autor_pin(pin_id)));

-- ─── Solicitudes ("Es mío") ─────────────────────────────────────────────────

create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pines (id) on delete cascade,
  solicitante_id uuid not null references public.perfiles (id) on delete cascade,
  -- Lo que el reclamante cree que es el dato ciego
  respuesta text not null check (char_length(respuesta) between 3 and 200),
  estado public.estado_solicitud not null default 'pendiente',
  creado_en timestamptz not null default now(),
  resuelta_en timestamptz,
  -- Clave de liberación de 4 dígitos: solo se guarda su hash (Fase 3)
  clave_hash text,
  intentos_clave smallint not null default 0 check (intentos_clave between 0 and 5),
  aceptada_en timestamptz
);
create index solicitudes_pin_idx on public.solicitudes (pin_id);
create index solicitudes_solicitante_idx on public.solicitudes (solicitante_id);
-- Una persona no puede tener dos solicitudes pendientes sobre el mismo pin
create unique index solicitudes_una_pendiente on public.solicitudes (pin_id, solicitante_id)
  where estado = 'pendiente';

alter table public.solicitudes enable row level security;
-- La ven quien la envió y el autor del pin. Se crean y resuelven solo con RPC (Fase 3).
create policy "ver solicitudes propias o de mis pines" on public.solicitudes
  for select to authenticated
  using ((select auth.uid()) = solicitante_id or (select private.es_autor_pin(pin_id)));

-- ─── Avisos dentro de la app ────────────────────────────────────────────────

create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo public.tipo_aviso not null,
  pin_id uuid references public.pines (id) on delete cascade,
  solicitud_id uuid references public.solicitudes (id) on delete cascade,
  leido boolean not null default false,
  creado_en timestamptz not null default now()
);
create index avisos_destinatario_idx on public.avisos (destinatario_id, leido);
create index avisos_pin_idx on public.avisos (pin_id);
create index avisos_solicitud_idx on public.avisos (solicitud_id);

alter table public.avisos enable row level security;
create policy "ver mis avisos" on public.avisos
  for select to authenticated
  using ((select auth.uid()) = destinatario_id);
-- Solo puede marcarlos como leídos (los crea el servidor; ver permisos por columna al final)
create policy "marcar mis avisos" on public.avisos
  for update to authenticated
  using ((select auth.uid()) = destinatario_id)
  with check ((select auth.uid()) = destinatario_id);

-- ─── Semestres (para reiniciar strikes y marcar "no reclamado") ─────────────

create table public.semestres (
  id serial primary key,
  nombre text not null unique,
  fecha_inicio date not null,
  fecha_fin date not null,
  check (fecha_fin > fecha_inicio)
);
alter table public.semestres enable row level security;
create policy "semestres visibles" on public.semestres for select to authenticated using (true);
create policy "admin administra semestres" on public.semestres
  for all to authenticated
  using ((select private.es_admin()))
  with check ((select private.es_admin()));

-- ─── Historial de estados (cadena de Markov) ────────────────────────────────

create table public.historial_estados (
  id bigint generated always as identity primary key,
  pin_id uuid not null references public.pines (id) on delete cascade,
  estado_anterior public.estado_objeto,
  estado_nuevo public.estado_objeto not null,
  cambiado_en timestamptz not null default now()
);
create index historial_estados_pin_idx on public.historial_estados (pin_id);
alter table public.historial_estados enable row level security;
create policy "admin ve el historial" on public.historial_estados
  for select to authenticated using ((select private.es_admin()));

create or replace function private.registrar_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    insert into public.historial_estados (pin_id, estado_anterior, estado_nuevo)
    values (new.id, case when tg_op = 'UPDATE' then old.estado end, new.estado);
  end if;
  return new;
end;
$$;

create trigger registrar_estado
  after insert or update of estado on public.pines
  for each row execute function private.registrar_estado();

-- ─── Permisos de tabla (además de RLS) ──────────────────────────────────────
-- Sin sesión (anon) no se puede usar ninguna tabla. Con sesión, se lee según RLS y casi
-- todo se escribe con funciones RPC; las únicas escrituras directas son por columna.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select on all tables in schema public to authenticated;
revoke insert, update, delete on
  public.perfiles, public.zonas, public.pines, public.datos_ciegos,
  public.solicitudes, public.avisos, public.historial_estados
  from authenticated;

grant update (nombre) on public.perfiles to authenticated;
grant update (leido) on public.avisos to authenticated;
-- El admin administra puntos seguros, su personal y los semestres (lo limita RLS)
grant insert, update, delete on public.puntos_seguros, public.personal_punto_seguro, public.semestres
  to authenticated;
grant usage on sequence public.semestres_id_seq to authenticated;
