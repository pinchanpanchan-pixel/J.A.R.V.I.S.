-- =====================================================================
-- v2 · Fase 6 — Estilos: Actual (gratis), Constelación y Pulso de luz (de pago)
-- El estilo se sincroniza entre dispositivos. Una cuenta Free no puede guardar un
-- estilo de pago (lo impide la base de datos, no solo la interfaz).
-- =====================================================================
alter table public.users
  add column if not exists ui_style text not null default 'actual'
    check (ui_style in ('actual', 'constelacion', 'pulso'));

create or replace function public.enforce_ui_style()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ui_style <> 'actual' and new.subscription = 'free' and not public.is_owner_email(new.email) then
    new.ui_style := 'actual';
  end if;
  return new;
end $$;

drop trigger if exists enforce_ui_style on public.users;
create trigger enforce_ui_style before insert or update of ui_style, subscription on public.users
  for each row execute function public.enforce_ui_style();
