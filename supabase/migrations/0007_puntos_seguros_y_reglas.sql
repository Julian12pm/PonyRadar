-- ════════════════════════════════════════════════════════════════════════════
-- 0007 · Puntos seguros y reglas de tiempo
--   · Quien encontró deja el objeto en un punto seguro: en_camino → (personal confirma)
--     → en_resguardo. Sin confirmación en 24 h se avisa a quien lo dejó y sigue en_camino.
--   · En resguardo, el dueño lo reclama igual ("Es mío"), pero responde y escribe la clave
--     el personal del punto seguro (quien lo encontró ya quedó deslindado).
--   · Strikes → aviso (1–2), suspensión de 7 días (3), de 30 días (4), bloqueo (5+).
--     Solo cuentan los del semestre vigente que el admin no haya quitado.
--   · Caducidad: activo → caducado a las 72 h; aceptado sin entrega en 72 h → se cancela
--     sin strike. Lo revisa una tarea de pg_cron cada 10 minutos.
--   · Renovar un pin rojo caducado (una sola vez, dentro de sus 30 días en "Se busca").
--   · Fin de semestre: el personal marca "no reclamado" lo que sigue en resguardo.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Columnas y tipos nuevos ────────────────────────────────────────────────

alter table public.pines add column en_camino_desde timestamptz;
alter table public.pines add column en_resguardo_desde timestamptz;
alter table public.pines add column aviso_24h_enviado boolean not null default false;

-- Listas "Se busca" (rojos caducados) y "En resguardo"
create index pines_listas_idx on public.pines (estado, expira_en)
  where estado in ('caducado', 'en_resguardo', 'en_camino');

-- ─── Ayudas internas ────────────────────────────────────────────────────────

-- ¿El usuario es personal de ese punto seguro?
create or replace function private.es_personal_de(punto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personal_punto_seguro
    where punto_id = punto and perfil_id = (select auth.uid())
  );
$$;
revoke execute on function private.es_personal_de(uuid) from public, anon;
grant execute on function private.es_personal_de(uuid) to authenticated;

-- ¿El usuario es personal del punto seguro que tiene (o recibirá) este pin?
create or replace function private.es_personal_del_pin(pin uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pines p
    join public.personal_punto_seguro s on s.punto_id = p.punto_seguro_id
    where p.id = pin
      and p.estado in ('en_camino', 'en_resguardo')
      and s.perfil_id = (select auth.uid())
  );
$$;
revoke execute on function private.es_personal_del_pin(uuid) from public, anon;
grant execute on function private.es_personal_del_pin(uuid) to authenticated;

-- Quién responde solicitudes y escribe la clave: el personal si está en resguardo;
-- si no, quien lo encontró.
create or replace function private.responsable_del_pin(pin uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.estado = 'en_resguardo' then private.es_personal_de(p.punto_seguro_id)
              else p.autor_id = (select auth.uid()) end
  from public.pines p where p.id = pin;
$$;
revoke execute on function private.responsable_del_pin(uuid) from public, anon, authenticated;

-- Estado al que regresa un pin sin solicitudes pendientes ni aceptadas:
-- sigue en resguardo si estaba ahí; si no, activo o caducado según sus 72 h.
create or replace function private.estado_sin_solicitudes(pin uuid)
returns public.estado_objeto
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.estado = 'en_resguardo' then 'en_resguardo'::public.estado_objeto
              when p.expira_en <= now() then 'caducado'::public.estado_objeto
              else 'activo'::public.estado_objeto end
  from public.pines p where p.id = pin;
$$;
revoke execute on function private.estado_sin_solicitudes(uuid) from public, anon, authenticated;

-- Avisa a todo el personal de un punto seguro
create or replace function private.avisar_personal(punto uuid, tipo public.tipo_aviso, pin uuid, solicitud uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.avisos (destinatario_id, tipo, pin_id, solicitud_id)
  select perfil_id, tipo, pin, solicitud from public.personal_punto_seguro where punto_id = punto;
$$;
revoke execute on function private.avisar_personal(uuid, public.tipo_aviso, uuid, uuid) from public, anon, authenticated;

-- ─── Lecturas para el personal del punto seguro ─────────────────────────────
-- Una sola política por acción (el asesor de rendimiento pide no sumar políticas permisivas)

alter policy "solo el autor lee el dato ciego" on public.datos_ciegos
  rename to "autor o punto seguro leen el dato ciego";
alter policy "autor o punto seguro leen el dato ciego" on public.datos_ciegos
  using ((select private.es_autor_pin(pin_id)) or (select private.es_personal_del_pin(pin_id)));

alter policy "ver solicitudes propias o de mis pines" on public.solicitudes
  rename to "ver solicitudes propias, de mis pines o de mi punto seguro";
alter policy "ver solicitudes propias, de mis pines o de mi punto seguro" on public.solicitudes
  using (
    (select auth.uid()) = solicitante_id
    or (select private.es_autor_pin(pin_id))
    or (select private.es_personal_del_pin(pin_id))
  );

-- ─── "Es mío" (también para objetos en resguardo) ───────────────────────────

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

  select * into v_pin from public.pines where id = p_pin for update;
  if not found or v_pin.tipo <> 'verde' then
    raise exception 'Solo se pueden reclamar pines verdes';
  end if;
  if v_pin.autor_id = v_usuario then
    raise exception 'No puedes reclamar tu propio pin';
  end if;
  if not (
    (v_pin.estado = 'activo' and v_pin.expira_en > now())
    or v_pin.estado in ('con_solicitud', 'en_resguardo')
  ) then
    raise exception 'Este objeto ya no se puede reclamar';
  end if;
  if exists (
    select 1 from public.solicitudes
    where pin_id = p_pin and estado = 'aceptada' and entregada_en is null
  ) then
    raise exception 'Este objeto ya está en entrega';
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

  if v_pin.estado = 'en_resguardo' then
    -- En resguardo el pin no cambia de estado; responde el personal del punto
    perform private.avisar_personal(v_pin.punto_seguro_id, 'reclamaron_mi_objeto', p_pin, v_solicitud);
  else
    update public.pines set estado = 'con_solicitud' where id = p_pin and estado = 'activo';
    perform private.avisar(v_pin.autor_id, 'reclamaron_mi_objeto', p_pin, v_solicitud);
  end if;
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
  if not coalesce(private.responsable_del_pin(v_pin.id), false) then
    raise exception 'Solo quien tiene el objeto puede responder';
  end if;
  if v_solicitud.estado <> 'pendiente' then
    raise exception 'Esta solicitud ya fue respondida';
  end if;

  if p_decision = 'aceptar' then
    update public.solicitudes
    set estado = 'aceptada', aceptada_en = now(), resuelta_en = now()
    where id = p_solicitud;
    -- En resguardo sigue en_resguardo hasta la entrega (sección 7: en_resguardo → entregado)
    if v_pin.estado <> 'en_resguardo' then
      update public.pines set estado = 'aceptado' where id = v_pin.id;
    end if;
    perform private.avisar(v_solicitud.solicitante_id, 'solicitud_aceptada', v_pin.id, p_solicitud);

    for v_otra in
      update public.solicitudes set estado = 'cancelada', resuelta_en = now()
      where pin_id = v_pin.id and estado = 'pendiente'
      returning id, solicitante_id
    loop
      perform private.avisar(v_otra.solicitante_id, 'solicitud_rechazada', v_pin.id, v_otra.id);
    end loop;
    return;
  end if;

  update public.solicitudes
  set estado = case when p_decision = 'impostor' then 'impostor'::public.estado_solicitud
                    else 'rechazada'::public.estado_solicitud end,
      resuelta_en = now()
  where id = p_solicitud;
  if p_decision = 'impostor' then
    -- El trigger de strikes calcula el castigo y avisa
    insert into public.strikes (perfil_id, solicitud_id)
    values (v_solicitud.solicitante_id, p_solicitud);
  end if;
  perform private.avisar(v_solicitud.solicitante_id, 'solicitud_rechazada', v_pin.id, p_solicitud);

  if not exists (
    select 1 from public.solicitudes where pin_id = v_pin.id and estado = 'pendiente'
  ) then
    update public.pines set estado = private.estado_sin_solicitudes(v_pin.id) where id = v_pin.id;
  end if;
end;
$$;

-- ─── Verificar la clave (quien lo encontró, o el personal si está en resguardo) ─

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
  if not coalesce(private.responsable_del_pin(v_pin.id), false) then
    raise exception 'Solo quien tiene el objeto puede escribir la clave';
  end if;
  if v_solicitud.estado <> 'aceptada' or v_solicitud.entregada_en is not null then
    raise exception 'Esta solicitud no está esperando entrega';
  end if;
  if v_solicitud.aceptada_en <= now() - interval '72 hours' then
    raise exception 'La aceptación venció: pasaron 72 horas sin entrega';
  end if;
  if v_solicitud.clave_hash is null then
    raise exception 'El dueño todavía no ha generado su clave';
  end if;

  if extensions.crypt(trim(p_clave), v_solicitud.clave_hash) = v_solicitud.clave_hash then
    update public.solicitudes set entregada_en = now() where id = p_solicitud;
    update public.pines set estado = 'entregado' where id = v_pin.id;
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

-- ─── Contacto: en resguardo, el dueño ve el punto seguro (sin correo personal) ─

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
  v_pin public.pines;
begin
  select * into v_solicitud from public.solicitudes where id = p_solicitud;
  if not found or v_solicitud.estado <> 'aceptada' then
    raise exception 'El contacto solo se comparte después de aceptar la solicitud';
  end if;
  select * into v_pin from public.pines where id = v_solicitud.pin_id;

  if v_pin.estado = 'en_resguardo' then
    if v_usuario = v_solicitud.solicitante_id then
      return query select s.nombre, null::text, 'punto_seguro'::text
        from public.puntos_seguros s where s.id = v_pin.punto_seguro_id;
    elsif private.es_personal_de(v_pin.punto_seguro_id) then
      return query select p.nombre, p.correo, 'dueno'::text
        from public.perfiles p where p.id = v_solicitud.solicitante_id;
    else
      raise exception 'No participas en este caso';
    end if;
    return;
  end if;

  if v_usuario = v_solicitud.solicitante_id then
    return query select p.nombre, p.correo, 'encontro'::text from public.perfiles p where p.id = v_pin.autor_id;
  elsif v_usuario = v_pin.autor_id then
    return query select p.nombre, p.correo, 'dueno'::text
      from public.perfiles p where p.id = v_solicitud.solicitante_id;
  else
    raise exception 'No participas en este caso';
  end if;
end;
$$;

-- ─── Punto seguro: dejar, confirmar, regresar, no reclamado ─────────────────

/** Quien encontró deja su objeto (activo o caducado) en un punto seguro: queda en_camino. */
create or replace function public.dejar_en_punto_seguro(p_pin uuid, p_punto uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.pines;
begin
  select * into v_pin from public.pines where id = p_pin for update;
  if not found or v_pin.autor_id is distinct from (select auth.uid()) or v_pin.tipo <> 'verde' then
    raise exception 'Solo quien encontró el objeto puede dejarlo en un punto seguro';
  end if;
  if v_pin.estado not in ('activo', 'caducado') then
    raise exception 'El objeto tiene una solicitud en curso o ya no está contigo';
  end if;
  if not exists (select 1 from public.puntos_seguros where id = p_punto and activo) then
    raise exception 'Ese punto seguro no está disponible';
  end if;
  update public.pines
  set estado = 'en_camino', punto_seguro_id = p_punto, en_camino_desde = now(),
      aviso_24h_enviado = false
  where id = p_pin;
end;
$$;

/** El personal del punto seguro confirma que recibió el objeto. */
create or replace function public.confirmar_recepcion(p_pin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.pines;
begin
  select * into v_pin from public.pines where id = p_pin for update;
  if not found or v_pin.estado <> 'en_camino' then
    raise exception 'Este objeto no está en camino';
  end if;
  if not private.es_personal_de(v_pin.punto_seguro_id) then
    raise exception 'Solo el personal de ese punto seguro puede confirmarlo';
  end if;
  update public.pines set estado = 'en_resguardo', en_resguardo_desde = now() where id = p_pin;
end;
$$;

/** Solo el admin: un objeto que nunca llegó al punto seguro vuelve al mapa (72 h nuevas). */
create or replace function public.regresar_a_activo(p_pin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_admin() then
    raise exception 'Solo el admin puede regresar un objeto en camino';
  end if;
  update public.pines
  set estado = 'activo', punto_seguro_id = null, en_camino_desde = null,
      aviso_24h_enviado = false, expira_en = now() + interval '72 hours'
  where id = p_pin and estado = 'en_camino';
  if not found then
    raise exception 'Este objeto no está en camino';
  end if;
end;
$$;

/**
 * Al terminar el semestre en que se recibió, el personal (o el admin) marca como
 * "no reclamado" lo que sigue en resguardo sin una entrega en curso.
 */
create or replace function public.marcar_no_reclamado(p_pin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.pines;
  v_fin date;
begin
  select * into v_pin from public.pines where id = p_pin for update;
  if not found or v_pin.estado <> 'en_resguardo' then
    raise exception 'Este objeto no está en resguardo';
  end if;
  if not (private.es_personal_de(v_pin.punto_seguro_id) or private.es_admin()) then
    raise exception 'Solo el personal del punto seguro puede marcarlo';
  end if;
  if exists (
    select 1 from public.solicitudes
    where pin_id = p_pin and estado = 'aceptada' and entregada_en is null
  ) then
    raise exception 'Hay una entrega en curso';
  end if;
  select fecha_fin into v_fin from public.semestres
  where v_pin.en_resguardo_desde::date between fecha_inicio and fecha_fin
  order by fecha_fin limit 1;
  if v_fin is not null and current_date <= v_fin then
    raise exception 'Se puede marcar al terminar el semestre (%)', to_char(v_fin, 'DD/MM/YYYY');
  end if;
  update public.pines set estado = 'no_reclamado' where id = p_pin;
end;
$$;

-- ─── Renovar un pin rojo caducado (una sola vez) ────────────────────────────

create or replace function public.renovar_pin(p_pin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.pines;
begin
  select * into v_pin from public.pines where id = p_pin for update;
  if not found or v_pin.autor_id is distinct from (select auth.uid()) then
    raise exception 'Solo quien publicó el pin puede renovarlo';
  end if;
  if not private.puede_publicar(v_pin.autor_id) then
    raise exception 'Tu cuenta está suspendida: no puedes renovar pines';
  end if;
  if v_pin.tipo <> 'rojo' then
    raise exception 'Solo se renuevan pines rojos';
  end if;
  if v_pin.renovado then
    raise exception 'Este pin ya se renovó una vez';
  end if;
  -- Caducado (o activo vencido que la tarea periódica aún no marca), dentro de sus 30 días
  if not (v_pin.estado in ('caducado', 'activo') and v_pin.expira_en <= now()
          and v_pin.expira_en > now() - interval '30 days') then
    raise exception 'Solo se renueva un pin que ya caducó, dentro de sus 30 días en "Se busca"';
  end if;
  update public.pines
  set estado = 'activo', expira_en = now() + interval '72 hours', renovado = true
  where id = p_pin;
end;
$$;

-- ─── Strikes → castigo ──────────────────────────────────────────────────────

-- Strikes que cuentan: los del semestre vigente que el admin no ha quitado
-- (si no hay semestre vigente, todos los no quitados).
create or replace function private.strikes_vigentes(perfil uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.strikes s
  where s.perfil_id = perfil
    and s.quitado_en is null
    and (
      not exists (select 1 from public.semestres where current_date between fecha_inicio and fecha_fin)
      or exists (
        select 1 from public.semestres m
        where current_date between m.fecha_inicio and m.fecha_fin
          and s.creado_en::date between m.fecha_inicio and m.fecha_fin
      )
    );
$$;
revoke execute on function private.strikes_vigentes(uuid) from public, anon, authenticated;

/** 1–2: solo aviso · 3: 7 días · 4: 30 días · 5+: bloqueo hasta revisión del admin. */
create or replace function private.aplicar_castigo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := private.strikes_vigentes(new.perfil_id);
begin
  if v_total >= 5 then
    update public.perfiles set bloqueado = true where id = new.perfil_id;
  elsif v_total in (3, 4) then
    update public.perfiles
    set suspendido_hasta = greatest(
      coalesce(suspendido_hasta, now()),
      now() + case when v_total = 3 then interval '7 days' else interval '30 days' end
    )
    where id = new.perfil_id;
  end if;
  -- El aviso ya lo recibe con la solicitud rechazada (estado "impostor"); la app lo muestra
  -- como strike junto con su conteo
  return new;
end;
$$;

create trigger aplicar_castigo
  after insert on public.strikes
  for each row execute function private.aplicar_castigo();

/** Cuántos strikes vigentes tengo (para mostrarlo en la app). */
create or replace function public.mis_strikes()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.strikes_vigentes((select auth.uid()));
$$;

-- ─── Reglas de tiempo (pg_cron cada 10 minutos) ─────────────────────────────

create or replace function private.aplicar_reglas_de_tiempo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol record;
  v_pin record;
begin
  -- aceptado sin entrega en 72 h → la solicitud se cancela sin strike
  for v_sol in
    update public.solicitudes set estado = 'cancelada', resuelta_en = now()
    where estado = 'aceptada' and entregada_en is null
      and aceptada_en <= now() - interval '72 hours'
    returning id, pin_id, solicitante_id
  loop
    update public.pines set estado = private.estado_sin_solicitudes(v_sol.pin_id)
    where id = v_sol.pin_id and estado = 'aceptado';
    perform private.avisar(v_sol.solicitante_id, 'solicitud_rechazada', v_sol.pin_id, v_sol.id);
  end loop;

  -- activo → caducado a las 72 h (con_solicitud no caduca mientras haya solicitud pendiente)
  update public.pines set estado = 'caducado'
  where estado = 'activo' and expira_en <= now();

  -- en_camino sin confirmar en 24 h → aviso a quien lo dejó (una vez) y sigue en_camino
  for v_pin in
    update public.pines set aviso_24h_enviado = true
    where estado = 'en_camino' and not aviso_24h_enviado
      and en_camino_desde <= now() - interval '24 hours'
    returning id, autor_id
  loop
    perform private.avisar(v_pin.autor_id, 'punto_seguro_sin_confirmar', v_pin.id);
  end loop;
end;
$$;
revoke execute on function private.aplicar_reglas_de_tiempo() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule(
  'ponyradar-reglas-de-tiempo',
  '*/10 * * * *',
  $$select private.aplicar_reglas_de_tiempo()$$
);

-- ─── Permisos de las funciones RPC nuevas ───────────────────────────────────

revoke execute on function public.dejar_en_punto_seguro(uuid, uuid) from public, anon;
revoke execute on function public.confirmar_recepcion(uuid) from public, anon;
revoke execute on function public.regresar_a_activo(uuid) from public, anon;
revoke execute on function public.marcar_no_reclamado(uuid) from public, anon;
revoke execute on function public.renovar_pin(uuid) from public, anon;
revoke execute on function public.mis_strikes() from public, anon;
grant execute on function public.dejar_en_punto_seguro(uuid, uuid) to authenticated;
grant execute on function public.confirmar_recepcion(uuid) to authenticated;
grant execute on function public.regresar_a_activo(uuid) to authenticated;
grant execute on function public.marcar_no_reclamado(uuid) to authenticated;
grant execute on function public.renovar_pin(uuid) to authenticated;
grant execute on function public.mis_strikes() to authenticated;
