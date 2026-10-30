-- ════════════════════════════════════════════════════════════════════════════
-- 0008 · Paneles de punto seguro y de admin
--   · Roles: el primer admin se asigna por SQL. Desde la app, solo un admin cambia roles,
--     y nadie puede quitarse a sí mismo el rol de admin (para no quedar sin admin).
--   · Personal de puntos seguros: el admin asigna (o se asigna) personal por correo.
--   · Strikes: el admin los quita; el castigo se recalcula. También desbloquea cuentas.
-- Los puntos seguros y los semestres el admin los edita directo (ya lo permite RLS, 0005).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Roles ──────────────────────────────────────────────────────────────────

create or replace function public.admin_cambiar_rol(p_perfil uuid, p_rol public.rol_usuario)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_admin() then
    raise exception 'Solo un admin puede cambiar roles';
  end if;
  if p_perfil = (select auth.uid()) and p_rol <> 'admin' then
    raise exception 'No puedes quitarte el rol de admin a ti mismo';
  end if;
  update public.perfiles set rol = p_rol where id = p_perfil;
  if not found then
    raise exception 'Ese usuario no existe';
  end if;
  -- Quien vuelve a ser "comunidad" deja de atender puntos seguros
  if p_rol = 'comunidad' then
    delete from public.personal_punto_seguro where perfil_id = p_perfil;
  end if;
end;
$$;

-- ─── Personal de puntos seguros ─────────────────────────────────────────────

/**
 * Asigna a alguien (por su correo) como personal de un punto seguro. Si era "comunidad",
 * pasa a "punto_seguro"; un admin conserva su rol (así puede probar los dos paneles).
 */
create or replace function public.admin_asignar_personal(p_punto uuid, p_correo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles;
begin
  if not private.es_admin() then
    raise exception 'Solo un admin puede asignar personal';
  end if;
  select * into v_perfil from public.perfiles where correo = lower(trim(p_correo));
  if not found then
    raise exception 'No hay una cuenta con ese correo (la persona debe iniciar sesión una vez)';
  end if;
  if not exists (select 1 from public.puntos_seguros where id = p_punto) then
    raise exception 'Ese punto seguro no existe';
  end if;
  insert into public.personal_punto_seguro (punto_id, perfil_id)
  values (p_punto, v_perfil.id)
  on conflict do nothing;
  if v_perfil.rol = 'comunidad' then
    update public.perfiles set rol = 'punto_seguro' where id = v_perfil.id;
  end if;
end;
$$;

/** Quita a alguien del personal; si ya no atiende ningún punto, vuelve a "comunidad". */
create or replace function public.admin_quitar_personal(p_punto uuid, p_perfil uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_admin() then
    raise exception 'Solo un admin puede quitar personal';
  end if;
  delete from public.personal_punto_seguro where punto_id = p_punto and perfil_id = p_perfil;
  update public.perfiles set rol = 'comunidad'
  where id = p_perfil and rol = 'punto_seguro'
    and not exists (select 1 from public.personal_punto_seguro where perfil_id = p_perfil);
end;
$$;

-- ─── Strikes y bloqueos ─────────────────────────────────────────────────────

/**
 * Quita un strike y recalcula el castigo con los que quedan:
 * con menos de 5 se desbloquea, con menos de 3 se levanta la suspensión.
 * (Si quedan 3 o 4, la suspensión vigente se respeta.)
 */
create or replace function public.admin_quitar_strike(p_strike uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
  v_total integer;
begin
  if not private.es_admin() then
    raise exception 'Solo un admin puede quitar strikes';
  end if;
  update public.strikes set quitado_en = now()
  where id = p_strike and quitado_en is null
  returning perfil_id into v_perfil;
  if v_perfil is null then
    raise exception 'Ese strike no existe o ya se quitó';
  end if;
  v_total := private.strikes_vigentes(v_perfil);
  update public.perfiles
  set bloqueado = bloqueado and v_total >= 5,
      suspendido_hasta = case when v_total < 3 then null else suspendido_hasta end
  where id = v_perfil;
end;
$$;

/** Revisión del admin: levanta el bloqueo y la suspensión (los strikes se quedan). */
create or replace function public.admin_desbloquear(p_perfil uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_admin() then
    raise exception 'Solo un admin puede desbloquear cuentas';
  end if;
  update public.perfiles set bloqueado = false, suspendido_hasta = null where id = p_perfil;
  if not found then
    raise exception 'Ese usuario no existe';
  end if;
end;
$$;

-- ─── Lectura para el admin: strikes vigentes de cada usuario ────────────────

create or replace function public.admin_strikes_vigentes(p_perfil uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.es_admin() then
    raise exception 'Solo un admin puede ver esto';
  end if;
  return private.strikes_vigentes(p_perfil);
end;
$$;

-- ─── Permisos ───────────────────────────────────────────────────────────────

revoke execute on function public.admin_cambiar_rol(uuid, public.rol_usuario) from public, anon;
revoke execute on function public.admin_asignar_personal(uuid, text) from public, anon;
revoke execute on function public.admin_quitar_personal(uuid, uuid) from public, anon;
revoke execute on function public.admin_quitar_strike(uuid) from public, anon;
revoke execute on function public.admin_desbloquear(uuid) from public, anon;
revoke execute on function public.admin_strikes_vigentes(uuid) from public, anon;
grant execute on function public.admin_cambiar_rol(uuid, public.rol_usuario) to authenticated;
grant execute on function public.admin_asignar_personal(uuid, text) to authenticated;
grant execute on function public.admin_quitar_personal(uuid, uuid) to authenticated;
grant execute on function public.admin_quitar_strike(uuid) to authenticated;
grant execute on function public.admin_desbloquear(uuid) to authenticated;
grant execute on function public.admin_strikes_vigentes(uuid) to authenticated;
