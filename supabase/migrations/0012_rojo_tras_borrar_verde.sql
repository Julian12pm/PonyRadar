-- ════════════════════════════════════════════════════════════════════════════
-- 0012 · Al borrar un pin verde vinculado, su pin rojo se recalcula
-- El trigger de 0010 (marcar_rojo_encontrado) solo corre al crear o cambiar un verde. Si el
-- admin borra un verde vinculado (admin_eliminar_pin), el rojo se quedaba con
-- encontrado = true y no volvía a mostrarse. (verde_en_curso sí se vaciaba solo, por la
-- llave foránea "on delete set null".)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function private.rojo_tras_borrar_verde()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.pin_vinculado_id is not null then
    perform private.actualizar_rojo_encontrado(old.pin_vinculado_id);
  end if;
  return old;
end;
$$;

create trigger rojo_tras_borrar_verde
  after delete on public.pines
  for each row execute function private.rojo_tras_borrar_verde();
