-- ════════════════════════════════════════════════════════════════════════════
-- 0004 · Fotos (Storage) y tiempo real
--
-- Bucket privado "fotos". Cada pin usa una carpeta con su id:
--   <pin>/publica.webp  → la ve cualquier usuario. En pines verdes va MUY desenfocada
--                          (el desenfoque se hace en el navegador antes de subirla).
--   <pin>/nitida.webp   → solo pines verdes; la ve únicamente su autor
--                          (en la Fase 3 también el dueño, tras ser aceptado).
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/webp'])
on conflict (id) do nothing;

-- ¿El archivo va en la carpeta de un pin de quien sube, con un nombre permitido?
-- La foto nítida solo se acepta en pines verdes. Se valida que la carpeta sea un uuid
-- antes de convertirla, para que un nombre raro no provoque un error.
create or replace function private.puede_subir_foto(ruta text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_carpeta text := split_part(ruta, '/', 1);
  v_archivo text := split_part(ruta, '/', 2);
begin
  if v_carpeta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or split_part(ruta, '/', 3) <> '' then
    return false;
  end if;
  return exists (
    select 1 from public.pines
    where id = v_carpeta::uuid
      and autor_id = (select auth.uid())
      and (v_archivo = 'publica.webp' or (v_archivo = 'nitida.webp' and tipo = 'verde'))
  );
end;
$$;
revoke execute on function private.puede_subir_foto(text) from public, anon;
grant execute on function private.puede_subir_foto(text) to authenticated;

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
  return private.es_autor_pin(v_carpeta::uuid);
end;
$$;
revoke execute on function private.puede_ver_foto_nitida(text) from public, anon;
grant execute on function private.puede_ver_foto_nitida(text) to authenticated;

create policy "subir fotos de mis pines" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (select private.puede_subir_foto(name)));

create policy "ver fotos públicas de pines" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and storage.filename(name) = 'publica.webp');

create policy "ver la foto nítida de mi pin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and storage.filename(name) = 'nitida.webp'
    and (select private.puede_ver_foto_nitida(name))
  );

-- ─── Tiempo real: el mapa recibe pines nuevos y cambios de estado al momento ──
-- Realtime respeta las políticas RLS de "pines" (solo usuarios con sesión).
alter publication supabase_realtime add table public.pines;
