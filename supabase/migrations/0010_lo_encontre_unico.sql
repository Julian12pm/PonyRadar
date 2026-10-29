-- ════════════════════════════════════════════════════════════════════════════
-- 0010 · "Lo encontré" una sola vez por pin rojo
--   · Si un pin rojo ya tiene un pin verde vinculado "en curso" (cualquier estado menos
--     entregado o no reclamado; un verde caducado sigue en curso), nadie más puede marcar
--     "Lo encontré".
--   · Un pin verde vinculado solo lo puede reclamar ("Es mío") el dueño del pin rojo, aunque
--     el verde haya caducado (el objeto sigue con quien lo encontró).
--   · En el pin rojo, dos columnas que mantiene un trigger:
--       verde_en_curso: el verde vinculado en curso (o null).
--       encontrado:     ese verde está vigente (no caducado). El mapa y "Se busca" ocultan
--                       el rojo para no mostrar el mismo objeto dos veces.
--     Si el verde caduca, el rojo vuelve a mostrarse en "Se busca" con la nota "Alguien dijo
--     que lo encontró" (verde_en_curso sigue lleno). Al entregarse, el rojo se cierra (ya lo
--     hace verificar_clave).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.pines add column encontrado boolean not null default false;
alter table public.pines
  add column verde_en_curso uuid references public.pines (id) on delete set null;
create index pines_verde_en_curso_idx on public.pines (verde_en_curso);
comment on column public.pines.encontrado is
  'Pin rojo con un pin verde vinculado vigente ("Lo encontré"): no se muestra en el mapa ni en "Se busca".';
comment on column public.pines.verde_en_curso is
  'Pin verde vinculado que aún no se entrega (aunque haya caducado).';

-- El verde vinculado en curso de un pin rojo (el más reciente), o null
create or replace function private.verde_en_curso(rojo uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.id from public.pines v
  where v.pin_vinculado_id = rojo
    and v.estado not in ('entregado', 'no_reclamado')
  order by v.creado_en desc
  limit 1;
$$;
revoke execute on function private.verde_en_curso(uuid) from public, anon, authenticated;

-- ¿El pin rojo tiene un verde vinculado en curso? (bloquea un segundo "Lo encontré")
create or replace function private.tiene_verde_en_curso(rojo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.verde_en_curso(rojo) is not null;
$$;
revoke execute on function private.tiene_verde_en_curso(uuid) from public, anon, authenticated;

-- Recalcula verde_en_curso y encontrado en un pin rojo
create or replace function private.actualizar_rojo_encontrado(rojo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verde uuid := private.verde_en_curso(rojo);
  v_vigente boolean := v_verde is not null and exists (
    select 1 from public.pines v where v.id = v_verde and v.estado <> 'caducado'
  );
begin
  update public.pines
  set verde_en_curso = v_verde, encontrado = v_vigente
  where id = rojo
    and (verde_en_curso is distinct from v_verde or encontrado is distinct from v_vigente);
end;
$$;
revoke execute on function private.actualizar_rojo_encontrado(uuid) from public, anon, authenticated;

-- Al crear o cambiar de estado un pin verde vinculado, se recalcula su rojo
create or replace function private.marcar_rojo_encontrado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pin_vinculado_id is not null then
    perform private.actualizar_rojo_encontrado(new.pin_vinculado_id);
  end if;
  return new;
end;
$$;

create trigger marcar_rojo_encontrado
  after insert or update of estado, pin_vinculado_id on public.pines
  for each row execute function private.marcar_rojo_encontrado();

-- Datos que ya existen
select private.actualizar_rojo_encontrado(r.id) from public.pines r where r.tipo = 'rojo';

-- ─── "Lo encontré": una sola vez mientras el anterior siga en curso ─────────

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
  -- Bloquea el rojo para que dos "Lo encontré" al mismo tiempo no pasen los dos
  select * into v_rojo from public.pines where id = p_pin_rojo for update;
  if not found or v_rojo.tipo <> 'rojo' then
    raise exception 'Solo se puede marcar "Lo encontré" en un pin rojo';
  end if;
  if v_rojo.autor_id = (select auth.uid()) then
    raise exception 'Es tu propio pin';
  end if;
  if not (
    (v_rojo.estado = 'activo' and v_rojo.expira_en > now())
    or (v_rojo.estado in ('activo', 'caducado') and v_rojo.expira_en > now() - interval '30 days')
  ) then
    raise exception 'Este pin ya no está activo';
  end if;
  if private.tiene_verde_en_curso(p_pin_rojo) then
    raise exception 'Alguien ya dijo que lo encontró';
  end if;

  v_verde := public.crear_pin(
    'verde', v_rojo.categoria, v_rojo.titulo, p_descripcion, v_rojo.zona_id,
    coalesce(nullif(trim(p_piso), ''), v_rojo.piso), v_rojo.x, v_rojo.y, p_dato_ciego
  );
  update public.pines set pin_vinculado_id = p_pin_rojo where id = v_verde;
  delete from public.avisos
  where pin_id = v_verde and destinatario_id = v_rojo.autor_id and tipo = 'coincidencia';
  perform private.avisar(v_rojo.autor_id, 'lo_encontraron', v_verde);
  return v_verde;
end;
$$;

-- ─── "Es mío" en un verde vinculado: solo el dueño del pin rojo ─────────────

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
  if v_pin.pin_vinculado_id is not null and not exists (
    select 1 from public.pines r where r.id = v_pin.pin_vinculado_id and r.autor_id = v_usuario
  ) then
    raise exception 'Este objeto lo encontraron para quien lo reportó como perdido: solo esa persona puede reclamarlo';
  end if;
  if not (
    (v_pin.estado = 'activo' and v_pin.expira_en > now())
    or v_pin.estado in ('con_solicitud', 'en_resguardo')
    -- Su dueño (ya revisado arriba) puede reclamar un verde vinculado aunque haya caducado
    or (v_pin.estado = 'caducado' and v_pin.pin_vinculado_id is not null)
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
    update public.pines set estado = 'con_solicitud'
    where id = p_pin and estado in ('activo', 'caducado');
    perform private.avisar(v_pin.autor_id, 'reclamaron_mi_objeto', p_pin, v_solicitud);
  end if;
  return v_solicitud;
end;
$$;
