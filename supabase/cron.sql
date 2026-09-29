-- ============================================================
-- Programación de las Edge Functions (ejecutar UNA vez en el SQL editor de Supabase).
-- Requiere las extensiones pg_cron y pg_net (Dashboard → Database → Extensions) y dos
-- secretos en Vault:  project_url  (https://<ref>.supabase.co)  y  service_role_key.
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.invoke_edge(fn text)
returns bigint language sql security definer set search_path = public as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
$$;

select cron.schedule('jarvis-world-monitor', '*/2 * * * *', $$select public.invoke_edge('world-monitor')$$);
select cron.schedule('jarvis-diary-reminders', '*/5 * * * *', $$select public.invoke_edge('diary-reminders')$$);
select cron.schedule('jarvis-home-automations', '* * * * *', $$select public.invoke_edge('home-automations')$$);
