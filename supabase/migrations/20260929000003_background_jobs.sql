-- Soporte para las Edge Functions en segundo plano.
alter table public.users add column if not exists diary_reminded_on date;

create index if not exists home_automations_enabled_idx on public.home_automations (enabled) where deleted_at is null;
create index if not exists world_monitor_quake_idx on public.world_monitor_settings (quake_enabled) where deleted_at is null;
