-- ════════════════════════════════════════════════════════════════════════════
-- 0003 · Crear pines (funciones RPC)
-- Los pines no se insertan directo desde el cliente: se crean con crear_pin(), que
-- revisa la sesión, la suspensión y el dato ciego, y guarda pin + dato ciego juntos.
-- ════════════════════════════════════════════════════════════════════════════

-- ¿Puede la persona crear pines o solicitudes? (no está suspendida ni bloqueada)
create or replace function private.puede_publicar(usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = usuario
      and not bloqueado
      and (suspendido_hasta is null or suspendido_hasta <= now())
  );
$$;
revoke execute on function private.puede_publicar(uuid) from public, anon;
grant execute on function private.puede_publicar(uuid) to authenticated;

/**
 * Crea un pin rojo ("Perdí algo") o verde ("Encontré esto").
 * Los pines verdes requieren un dato ciego, que se guarda aparte y solo lo lee su autor.
 * Regresa el id del pin nuevo.
 */
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
revoke execute on function public.crear_pin(
  public.tipo_pin, public.categoria_objeto, text, text, text, text, real, real, text
) from public, anon;
grant execute on function public.crear_pin(
  public.tipo_pin, public.categoria_objeto, text, text, text, text, real, real, text
) to authenticated;

/**
 * Después de subir las fotos a Storage (bucket "fotos", carpeta = id del pin), el autor llama
 * a esta función para que el pin apunte a ellas. Solo se registran las fotos que de verdad
 * existen en Storage.
 */
create or replace function public.adjuntar_fotos(p_pin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.pines;
begin
  select * into v_pin from public.pines where id = p_pin;
  if not found or v_pin.autor_id is distinct from (select auth.uid()) then
    raise exception 'Solo el autor del pin puede adjuntar fotos';
  end if;

  update public.pines
  set
    foto_publica = case
      when exists (
        select 1 from storage.objects
        where bucket_id = 'fotos' and name = p_pin::text || '/publica.webp'
      ) then p_pin::text || '/publica.webp'
    end,
    tiene_foto_nitida = v_pin.tipo = 'verde' and exists (
      select 1 from storage.objects
      where bucket_id = 'fotos' and name = p_pin::text || '/nitida.webp'
    )
  where id = p_pin;
end;
$$;
revoke execute on function public.adjuntar_fotos(uuid) from public, anon;
grant execute on function public.adjuntar_fotos(uuid) to authenticated;
