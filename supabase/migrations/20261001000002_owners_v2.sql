-- =====================================================================
-- v2 · Fase 3 — Propietarios
--  * Propietario = email en public.app_owner_emails (pinchan.panchan@gmail.com y
--    mateolabandayt@gmail.com). Ya NO se es propietario por canjear un código.
--  * PANCHAN100 solo lo pueden canjear los propietarios (para el resto es «código no válido»).
--  * Proveedores de IA y Códigos de descuento: solo propietarios, también en la base de datos.
--  * Preparado para la futura app de propietario: función admin_stats() (solo propietarios).
-- =====================================================================

create table if not exists public.app_owner_emails (
  email text primary key check (email = lower(trim(email)))
);
alter table public.app_owner_emails enable row level security;
-- Nadie la lee desde el cliente: solo las funciones security definer de abajo.
insert into public.app_owner_emails (email) values
  ('pinchan.panchan@gmail.com'),
  ('mateolabandayt@gmail.com')
on conflict do nothing;

create or replace function public.is_owner_email(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_owner_emails where email = lower(trim(coalesce(p_email, ''))));
$$;
revoke all on function public.is_owner_email(text) from public;

-- is_owner(): por email (aunque la marca de la fila estuviera desfasada).
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.is_owner_email(email) from public.users where id = auth.uid()), false);
$$;

-- Alta: los propietarios nacen con is_owner y Pro de por vida; el resto, Free.
create or replace function public.protect_user_billing_fields_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then
    new.is_owner := public.is_owner_email(new.email);
    new.subscription := case when new.is_owner then 'pro_lifetime' else 'free' end;
    new.subscription_period := case when new.is_owner then 'lifetime' else null end;
    new.stripe_customer_id := null;
  end if;
  return new;
end $$;

-- El alta desde auth.users (trigger con permisos de backend) también marca a los propietarios.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner boolean := public.is_owner_email(new.email);
begin
  insert into public.users (id, email, is_owner, subscription, subscription_period)
  values (new.id, coalesce(new.email, ''), v_owner,
          case when v_owner then 'pro_lifetime' else 'free' end,
          case when v_owner then 'lifetime' else null end)
  on conflict (id) do nothing;
  insert into public.user_core_memory (id, user_id) values (new.id, new.id) on conflict do nothing;
  insert into public.voice_prefs (id, user_id) values (new.id, new.id) on conflict do nothing;
  insert into public.world_monitor_settings (id, user_id) values (new.id, new.id) on conflict do nothing;
  return new;
end $$;

-- Marca de propietario al día: quien ya no está en la lista la pierde (conserva su plan),
-- y los emails de la lista la tienen con Pro de por vida.
update public.users set is_owner = false where is_owner and not public.is_owner_email(email);
update public.users
   set is_owner = true, subscription = 'pro_lifetime', subscription_period = 'lifetime', subscription_status = 'active'
 where public.is_owner_email(email) and (not is_owner or subscription <> 'pro_lifetime');

-- Códigos solo para propietarios
alter table public.discount_codes add column if not exists owners_only boolean not null default false;
update public.discount_codes set owners_only = true, max_uses = null where code = 'PANCHAN100';

create or replace function public.redeem_discount_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.discount_codes%rowtype;
  v_user uuid := auth.uid();
  v_owner boolean;
  v_plan text;
  v_period text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  v_owner := public.is_owner();

  select * into c from public.discount_codes
   where code = upper(trim(p_code))
     and is_active
     and (valid_until is null or valid_until > now())
     and (max_uses is null or used_count < max_uses)
   for update;

  -- Un código de propietario canjeado por otra cuenta es, a todos los efectos, inválido
  -- (no se revela que existe).
  if not found or (c.owners_only and not v_owner) then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if exists (select 1 from public.discount_redemptions where user_id = v_user and code = c.code) then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  if c.percent_off < 100 then
    return jsonb_build_object('ok', true, 'code', c.code, 'percent_off', c.percent_off,
                              'duration', c.duration, 'applied', false);
  end if;

  v_plan := coalesce(c.grants_plan, 'pro_lifetime');
  v_period := coalesce(c.grants_period, 'lifetime');

  update public.discount_codes set used_count = used_count + 1 where id = c.id;
  insert into public.discount_redemptions (user_id, code) values (v_user, c.code);
  insert into public.subscriptions (user_id, plan, period, status, provider, discount_code, amount_cents)
    values (v_user, v_plan, v_period, 'active', 'code', c.code, 0);
  update public.users
     set subscription = v_plan,
         subscription_period = v_period,
         subscription_status = 'active'
   where id = v_user;

  return jsonb_build_object('ok', true, 'code', c.code, 'percent_off', 100,
                            'plan', v_plan, 'period', v_period, 'applied', true);
end $$;
revoke all on function public.redeem_discount_code(text) from public;
grant execute on function public.redeem_discount_code(text) to authenticated;

-- Proveedores de IA: cada uno ve y borra las suyas, pero solo un propietario puede añadir o cambiar.
drop policy if exists ai_provider_keys_owner_all on public.ai_provider_keys;
drop policy if exists ai_provider_keys_select on public.ai_provider_keys;
drop policy if exists ai_provider_keys_insert on public.ai_provider_keys;
drop policy if exists ai_provider_keys_update on public.ai_provider_keys;
drop policy if exists ai_provider_keys_delete on public.ai_provider_keys;
create policy ai_provider_keys_select on public.ai_provider_keys for select using (user_id = auth.uid());
create policy ai_provider_keys_insert on public.ai_provider_keys for insert with check (user_id = auth.uid() and public.is_owner());
create policy ai_provider_keys_update on public.ai_provider_keys for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_owner());
create policy ai_provider_keys_delete on public.ai_provider_keys for delete using (user_id = auth.uid());

-- Futura app de propietario: métricas agregadas (sin datos personales), solo propietarios.
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owners only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.users where deleted_at is null),
    'users_last_7d', (select count(*) from public.users where created_at > now() - interval '7 days'),
    'onboarded', (select count(*) from public.users where onboarding_completed),
    'by_plan', (select coalesce(jsonb_object_agg(subscription, n), '{}'::jsonb)
                  from (select subscription, count(*) n from public.users group by subscription) s),
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active' and provider in ('stripe', 'paypal')),
    'revenue_cents', (select coalesce(sum(amount_cents), 0) from public.subscriptions where provider in ('stripe', 'paypal')),
    'codes_redeemed', (select count(*) from public.discount_redemptions),
    'messages_last_24h', (select count(*) from public.chat_messages where created_at > now() - interval '24 hours'),
    'generated_at', now()
  );
end $$;
revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;
