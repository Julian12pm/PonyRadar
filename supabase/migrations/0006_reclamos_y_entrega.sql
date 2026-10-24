-- ════════════════════════════════════════════════════════════════════════════
-- 0006 · Reclamos y entrega
--   · "Es mío": solicitar un pin verde escribiendo lo que se cree que es el dato ciego.
--   · Quien encontró acepta, rechaza o rechaza por impostor (+1 strike).
--   · Clave de liberación de 4 dígitos: la genera el servidor, solo la ve el dueño, se guarda
--     como hash y se verifica con máximo 5 intentos fallidos.
--   · Tarjeta de contacto (nombre y correo) solo entre las dos partes, y solo tras aceptar.
--   · "Lo encontré": crea un pin verde vinculado a un pin rojo y avisa a su dueño.
--   · Avisos dentro de la app, incluida la coincidencia de categoría y zona.
-- Los cambios de estado siguen exactamente las transiciones de la especificación (sección 7).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Columnas nuevas ────────────────────────────────────────────────────────

alter table public.solicitudes add column entregada_en timestamptz;
alter table public.solicitudes add column clave_generada_en timestamptz;

-- El hash de una clave de 4 dígitos se rompe probando las 10 000 combinaciones, así que
-- NADIE lo puede leer por la API (ni el dueño ni quien encontró). Se cambian los permisos
-- de la tabla por permisos por columna, sin clave_hash.
revoke select on public.solicitudes from authenticated;
grant select (
  id, pin_id, solicitante_id, respuesta, estado, creado_en, resuelta_en,
  intentos_clave, aceptada_en, entregada_en, clave_generada_en
) on public.solicitudes to authenticated;

-- ─── Strikes ────────────────────────────────────────────────────────────────
-- Solo se dan al rechazar por impostor a alguien que envió una solicitud a tu pin.
-- La suspensión que provocan se calcula en la Fase 4.

create table public.strikes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  solicitud_id uuid not null unique references public.solicitudes (id) on delete cascade,
  creado_en timestamptz not null default now(),
  quitado_en timestamptz -- el admin puede quitarlo (Fase 5)
);
create index strikes_perfil_idx on public.strikes (perfil_id);
alter table public.strikes enable row level security;
create policy "ver mis strikes o admin" on public.strikes
  for select to authenticated
  using ((select auth.uid()) = perfil_id or (select private.es_admin()));
revoke insert, update, delete on public.strikes from authenticated;
revoke all on public.strikes from anon;

-- ─── Ayudas internas ────────────────────────────────────────────────────────

create or replace function private.avisar(
  destinatario uuid, tipo public.tipo_aviso, pin uuid, solicitud uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.avisos (destinatario_id, tipo, pin_id, solicitud_id)
  values (destinatario, tipo, pin, solicitud);
$$;
revoke execute on function private.avisar(uuid, public.tipo_aviso, uuid, uuid) from public, anon, authenticated;

-- Estado al que regresa un pin cuando ya no tiene solicitudes pendientes:
-- activo, o caducado si ya pasaron sus 72 h (especificación, sección 7).
create or replace function private.estado_sin_solicitudes(pin uuid)
returns public.estado_objeto
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.expira_en <= now() then 'caducado'::public.estado_objeto
              else 'activo'::public.estado_objeto end
  from public.pines p where p.id = pin;
$$;
revoke execute on function private.estado_sin_solicitudes(uuid) from public, anon, authenticated;

-- ─── Foto nítida: también para el dueño una vez aceptado ────────────────────
-- Antes solo la veía el autor del pin verde. Tras aceptar la solicitud, el dueño la puede ver
-- para reconocer su objeto antes de la entrega.
create or replace function private.puede_ver_foto_nitida(ruta text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_carpeta text := split_part(ruta, '/', 1);
begin
  if v_carpeta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.es_autor_pin(v_carpeta::uuid) or exists (
    select 1 from public.solicitudes s
    where s.pin_id = v_carpeta::uuid
      and s.solicitante_id = (select auth.uid())
      and s.estado = 'aceptada'
  );
end;
$$;

-- ─── "Es mío" ───────────────────────────────────────────────────────────────

create or replace function public.solicitar_pin(p_pin uuid, p_respuesta text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_pin public.pines;
  v_solicitud uuid;
begin
  if v_usuario is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  if not private.puede_publicar(v_usuario) then
    raise exception 'Tu cuenta está suspendida: no puedes enviar solicitudes';
  end if;

  -- Bloquea el pin para que dos solicitudes simultáneas no se pisen
  select * into v_pin from public.pines where id = p_pin for update;
  if not found or v_pin.tipo <> 'verde' then
    raise exception 'Solo se pueden reclamar pines verdes';
  end if;
  if v_pin.autor_id = v_usuario then
    raise exception 'No puedes reclamar tu propio pin';
  end if;
  if not (
    (v_pin.estado = 'activo' and v_pin.expira_en > now()) or v_pin.estado = 'con_solicitud'
  ) then
    raise exception 'Este objeto ya no se puede reclamar';
  end if;
  if exists (
    select 1 from public.solicitudes
    where pin_id = p_pin and solicitante_id = v_usuario and estado = 'pendiente'
  ) then
    raise exception 'Ya enviaste una solicitud para este objeto';
  end if;

  insert into public.solicitudes (pin_id, solicitante_id, respuesta)
  values (p_pin, v_usuario, trim(p_respuesta))
  returning id into v_solicitud;

  update public.pines set estado = 'con_solicitud' where id = p_pin and estado = 'activo';
  perform private.avisar(v_pin.autor_id, 'reclamaron_mi_objeto', p_pin, v_solicitud);
  return v_solicitud;
end;
$$;

-- ─── Aceptar / rechazar / impostor ──────────────────────────────────────────

create or replace function public.responder_solicitud(p_solicitud uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_solicitud public.solicitudes;
  v_pin public.pines;
  v_otra record;
begin
  if p_decision not in ('aceptar', 'rechazar', 'impostor') then
    raise exception 'Decisión no válida';
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud for update;
  if not found then
    raise exception 'La solicitud no existe';
  end if;
  select * into v_pin from public.pines where id = v_solicitud.pin_id for update;
  if v_pin.autor_id is distinct from v_usuario then
    raise exception 'Solo quien encontró el objeto puede responder';
  end if;
  if v_solicitud.estado <> 'pendiente' then
    raise exception 'Esta solicitud ya fue respondida';
  end if;

  if p_decision = 'aceptar' then
    update public.solicitudes
    set estado = 'aceptada', aceptada_en = now(), resuelta_en = now()
    where id = p_solicitud;
    update public.pines set estado = 'aceptado' where id = v_pin.id;
    perform private.avisar(v_solicitud.solicitante_id, 'solicitud_aceptada', v_pin.id, p_solicitud);

    -- Las demás solicitudes pendientes del mismo pin se cancelan (sin strike) y se avisa
    for v_otra in
      update public.solicitudes set estado = 'cancelada', resuelta_en = now()
      where pin_id = v_pin.id and estado = 'pendiente'
      returning id, solicitante_id
    loop
      perform private.avisar(v_otra.solicitante_id, 'solicitud_rechazada', v_pin.id, v_otra.id);
    end loop;
    return;
  end if;

  -- Rechazar (por error) o rechazar por impostor (+1 strike)
  update public.solicitudes
  set estado = case when p_decision = 'impostor' then 'impostor'::public.estado_solicitud
                    else 'rechazada'::public.estado_solicitud end,
      resuelta_en = now()
  where id = p_solicitud;
  if p_decision = 'impostor' then
    insert into public.strikes (perfil_id, solicitud_id)
    values (v_solicitud.solicitante_id, p_solicitud);
  end if;
  perform private.avisar(v_solicitud.solicitante_id, 'solicitud_rechazada', v_pin.id, p_solicitud);

  -- Si ya no quedan solicitudes pendientes, el pin regresa a activo (o caducado si pasaron 72 h)
  if not exists (
    select 1 from public.solicitudes where pin_id = v_pin.id and estado = 'pendiente'
  ) then
    update public.pines set estado = private.estado_sin_solicitudes(v_pin.id) where id = v_pin.id;
  end if;
end;
$$;

-- ─── Clave de liberación ────────────────────────────────────────────────────

/**
 * La pide el dueño (quien envió la solicitud aceptada). Regresa la clave de 4 dígitos UNA vez:
 * en la base solo queda su hash. Si la olvida, puede pedir otra (la anterior deja de servir),
 * pero los intentos fallidos acumulados no se reinician.
 */
create or replace function public.generar_clave(p_solicitud uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud public.solicitudes;
  v_bytes bytea := extensions.gen_random_bytes(3);
  v_clave text;
begin
  select * into v_solicitud from public.solicitudes where id = p_solicitud for update;
  if not found or v_solicitud.solicitante_id is distinct from (select auth.uid()) then
    raise exception 'Solo el dueño puede ver su clave';
  end if;
  if v_solicitud.estado <> 'aceptada' or v_solicitud.entregada_en is not null then
    raise exception 'Esta solicitud no está esperando entrega';
  end if;
  -- 72 h después de aceptar sin entrega, la aceptación vence (la cancela la tarea de la Fase 4)
  if v_solicitud.aceptada_en <= now() - interval '72 hours' then
    raise exception 'La aceptación venció: pasaron 72 horas sin entrega';
  end if;

  -- 4 dígitos al azar a partir de bytes aleatorios seguros
  v_clave := lpad(
    ((get_byte(v_bytes, 0) * 65536 + get_byte(v_bytes, 1) * 256 + get_byte(v_bytes, 2)) % 10000)::text,
    4, '0'
  );
  update public.solicitudes
  set clave_hash = extensions.crypt(v_clave, extensions.gen_salt('bf')),
      clave_generada_en = now()
  where id = p_solicitud;
  return v_clave;
end;
$$;

/**
 * Quien tiene el objeto escribe la clave que le dicta el dueño en persona.
 * No lanza error si la clave es incorrecta (para que el intento sí se cuente): regresa
 * { "ok": bool, "intentos_restantes": n }. Al quinto fallo la aceptación se cancela y el
 * pin vuelve a estar disponible.
 */
create or replace function public.verificar_clave(p_solicitud uuid, p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud public.solicitudes;
  v_pin public.pines;
  v_intentos smallint;
begin
  select * into v_solicitud from public.solicitudes where id = p_solicitud for update;
  if not found then
    raise exception 'La solicitud no existe';
  end if;
  select * into v_pin from public.pines where id = v_solicitud.pin_id for update;
  if v_pin.autor_id is distinct from (select auth.uid()) then
    raise exception 'Solo quien tiene el objeto puede escribir la clave';
  end if;
  if v_solicitud.estado <> 'aceptada' or v_solicitud.entregada_en is not null then
    raise exception 'Esta solicitud no está esperando entrega';
  end if;
  -- 72 h después de aceptar sin entrega, la aceptación vence (la cancela la tarea de la Fase 4)
  if v_solicitud.aceptada_en <= now() - interval '72 hours' then
    raise exception 'La aceptación venció: pasaron 72 horas sin entrega';
  end if;
  if v_solicitud.clave_hash is null then
    raise exception 'El dueño todavía no ha generado su clave';
  end if;

  if extensions.crypt(trim(p_clave), v_solicitud.clave_hash) = v_solicitud.clave_hash then
    update public.solicitudes set entregada_en = now() where id = p_solicitud;
    update public.pines set estado = 'entregado' where id = v_pin.id;
    -- Si el pin verde venía de un "Lo encontré", el pin rojo de su dueño también se cierra
    update public.pines set estado = 'entregado'
    where id = v_pin.pin_vinculado_id and autor_id = v_solicitud.solicitante_id;
    return jsonb_build_object('ok', true, 'intentos_restantes', 5 - v_solicitud.intentos_clave);
  end if;

  v_intentos := v_solicitud.intentos_clave + 1;
  if v_intentos >= 5 then
    update public.solicitudes
    set intentos_clave = 5, estado = 'cancelada', resuelta_en = now()
    where id = p_solicitud;
    update public.pines set estado = private.estado_sin_solicitudes(v_pin.id) where id = v_pin.id;
    perform private.avisar(v_solicitud.solicitante_id, 'solicitud_rechazada', v_pin.id, p_solicitud);
  else
    update public.solicitudes set intentos_clave = v_intentos where id = p_solicitud;
  end if;
  return jsonb_build_object('ok', false, 'intentos_restantes', greatest(0, 5 - v_intentos));
end;
$$;

-- ─── Tarjeta de contacto ────────────────────────────────────────────────────

/** Nombre y correo de la OTRA parte del caso, solo si la solicitud fue aceptada. */
create or replace function public.contacto_del_caso(p_solicitud uuid)
returns table (nombre text, correo text, papel text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_solicitud public.solicitudes;
  v_autor uuid;
begin
  select * into v_solicitud from public.solicitudes where id = p_solicitud;
  if not found or v_solicitud.estado <> 'aceptada' then
    raise exception 'El contacto solo se comparte después de aceptar la solicitud';
  end if;
  select autor_id into v_autor from public.pines where id = v_solicitud.pin_id;

  if v_usuario = v_solicitud.solicitante_id then
    return query select p.nombre, p.correo, 'encontro'::text from public.perfiles p where p.id = v_autor;
  elsif v_usuario = v_autor then
    return query select p.nombre, p.correo, 'dueno'::text
      from public.perfiles p where p.id = v_solicitud.solicitante_id;
  else
    raise exception 'No participas en este caso';
  end if;
end;
$$;

-- ─── "Lo encontré" en un pin rojo ───────────────────────────────────────────

/**
 * Quien encontró un objeto que alguien reportó como perdido crea un pin verde vinculado,
 * en el mismo lugar y con la misma categoría y título, más su dato ciego. Se avisa al dueño,
 * que después lo reclama con "Es mío" como cualquier pin verde.
 */
create or replace function public.lo_encontre(
  p_pin_rojo uuid, p_descripcion text, p_piso text, p_dato_ciego text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rojo public.pines;
  v_verde uuid;
begin
  select * into v_rojo from public.pines where id = p_pin_rojo;
  if not found or v_rojo.tipo <> 'rojo' then
    raise exception 'Solo se puede marcar "Lo encontré" en un pin rojo';
  end if;
  if v_rojo.autor_id = (select auth.uid()) then
    raise exception 'Es tu propio pin';
  end if;
  if v_rojo.estado <> 'activo' or v_rojo.expira_en <= now() then
    raise exception 'Este pin ya no está activo';
  end if;

  -- crear_pin revisa la sesión, la suspensión y el dato ciego
  v_verde := public.crear_pin(
    'verde', v_rojo.categoria, v_rojo.titulo, p_descripcion, v_rojo.zona_id,
    coalesce(nullif(trim(p_piso), ''), v_rojo.piso), v_rojo.x, v_rojo.y, p_dato_ciego
  );
  update public.pines set pin_vinculado_id = p_pin_rojo where id = v_verde;
  -- El trigger de coincidencias ya avisó al dueño; se cambia por el aviso más preciso
  delete from public.avisos
  where pin_id = v_verde and destinatario_id = v_rojo.autor_id and tipo = 'coincidencia';
  perform private.avisar(v_rojo.autor_id, 'lo_encontraron', v_verde);
  return v_verde;
end;
$$;

-- ─── Coincidencia: pin verde de la misma categoría y zona que un rojo ───────

create or replace function private.avisar_coincidencias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo = 'verde' and new.pin_vinculado_id is null then
    insert into public.avisos (destinatario_id, tipo, pin_id)
    select r.autor_id, 'coincidencia', new.id
    from public.pines r
    where r.tipo = 'rojo'
      and r.estado = 'activo'
      and r.expira_en > now()
      and r.categoria = new.categoria
      and r.zona_id = new.zona_id
      and r.autor_id <> new.autor_id;
  end if;
  return new;
end;
$$;

create trigger avisar_coincidencias
  after insert on public.pines
  for each row execute function private.avisar_coincidencias();

-- ─── Permisos de las funciones RPC (solo usuarios con sesión) ───────────────

revoke execute on function public.solicitar_pin(uuid, text) from public, anon;
revoke execute on function public.responder_solicitud(uuid, text) from public, anon;
revoke execute on function public.generar_clave(uuid) from public, anon;
revoke execute on function public.verificar_clave(uuid, text) from public, anon;
revoke execute on function public.contacto_del_caso(uuid) from public, anon;
revoke execute on function public.lo_encontre(uuid, text, text, text) from public, anon;
grant execute on function public.solicitar_pin(uuid, text) to authenticated;
grant execute on function public.responder_solicitud(uuid, text) to authenticated;
grant execute on function public.generar_clave(uuid) to authenticated;
grant execute on function public.verificar_clave(uuid, text) to authenticated;
grant execute on function public.contacto_del_caso(uuid) to authenticated;
grant execute on function public.lo_encontre(uuid, text, text, text) to authenticated;

-- ─── Tiempo real para avisos ────────────────────────────────────────────────
-- "solicitudes" NO se publica: el tiempo real enviaría la fila completa (con clave_hash).
-- Cada cambio de una solicitud genera un aviso, y con ese aviso la app recarga sus casos.
alter publication supabase_realtime add table public.avisos;
