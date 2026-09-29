-- =====================================================================
-- J.A.R.V.I.S. — esquema principal
-- Todas las tablas con Row Level Security activado y publicadas en Realtime.
-- Convención de sincronización:
--   * id uuid generado en el cliente (permite escribir offline)
--   * updated_at  -> last-write-wins entre dispositivos
--   * deleted_at  -> borrado lógico, para que el borrado también se sincronice
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.is_service_role()
returns boolean language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
      or coalesce((nullif(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'role', '') = 'service_role'
      or current_user in ('postgres', 'supabase_admin', 'service_role');
$$;

-- updated_at   = marca del cliente (last-write-wins entre dispositivos)
-- server_updated_at = marca del servidor (cursor de sincronización incremental)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  if new.updated_at is null then
    new.updated_at := now();
  end if;
  if tg_op = 'UPDATE' then
    if public.is_service_role() then
      -- Cambios del backend: siempre más recientes que lo que tengan los clientes.
      if new.updated_at <= old.updated_at then
        new.updated_at := greatest(now(), old.updated_at + interval '1 millisecond');
      end if;
    elsif new.updated_at < old.updated_at then
      -- Escritura antigua de un dispositivo que estuvo offline: gana la versión más nueva.
      return null;
    end if;
  end if;
  return new;
end $$;

-- array_to_string no es IMMUTABLE; envoltorio para usarlo en columnas generadas.
create or replace function public.tags_to_text(tags text[])
returns text language sql immutable parallel safe as $$
  select coalesce(array_to_string(tags, ' '), '');
$$;


-- ---------------------------------------------------------------------
-- users (perfil + ajustes globales sincronizados)
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  user_id uuid generated always as (id) stored,
  email text not null,
  is_owner boolean not null default false,
  subscription text not null default 'free'
    check (subscription in ('free', 'pro_lite', 'pro', 'founder', 'pro_lifetime')),
  subscription_period text check (subscription_period in ('monthly', 'yearly', 'lifetime')),
  subscription_status text not null default 'active',
  subscription_renews_at timestamptz,
  stripe_customer_id text,
  onboarding_step integer not null default 1,
  onboarding_completed boolean not null default false,
  diary_reminder_time text default '22:30' check (diary_reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  diary_reminder_label text default 'Noche',
  floating_mode_enabled boolean not null default false,
  wake_clap_enabled boolean not null default true,
  wake_button_enabled boolean not null default true,
  wake_word_enabled boolean not null default true,
  timezone text default 'UTC',
  locale text default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Campos que solo el backend (service_role) puede cambiar.
create or replace function public.protect_user_billing_fields()
returns trigger language plpgsql as $$
begin
  if public.is_service_role() then
    return new;
  end if;
  if new.is_owner is distinct from old.is_owner
     or new.subscription is distinct from old.subscription
     or new.subscription_period is distinct from old.subscription_period
     or new.subscription_status is distinct from old.subscription_status
     or new.subscription_renews_at is distinct from old.subscription_renews_at
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.email is distinct from old.email then
    raise exception 'protected fields can only be changed by the backend';
  end if;
  return new;
end $$;

create or replace function public.protect_user_billing_fields_insert()
returns trigger language plpgsql as $$
begin
  if not public.is_service_role() then
    new.is_owner := false;
    new.subscription := 'free';
    new.subscription_period := null;
    new.stripe_customer_id := null;
  end if;
  return new;
end $$;

-- Crea la fila de perfil al registrarse.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  -- Las filas "una por usuario" usan id = user_id: así cualquier dispositivo
  -- puede crearlas offline sin generar duplicados.
  insert into public.user_core_memory (id, user_id) values (new.id, new.id)
  on conflict do nothing;
  insert into public.voice_prefs (id, user_id) values (new.id, new.id)
  on conflict do nothing;
  insert into public.world_monitor_settings (id, user_id) values (new.id, new.id)
  on conflict do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- user_core_memory — identidad y hechos esenciales
-- ---------------------------------------------------------------------
create table if not exists public.user_core_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  user_name text,
  assistant_name text not null default 'J.A.R.V.I.S.',
  facts jsonb not null default '[]'::jsonb,
  personality_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- memory_blocks — memoria tipo Notion con búsqueda full-text + embeddings
-- ---------------------------------------------------------------------
create table if not exists public.memory_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  source text not null default 'manual'
    check (source in ('voice', 'whatsapp', 'manual', 'vision', 'quick_note', 'diary', 'import', 'chat')),
  original_date timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  search tsvector generated always as (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('simple', public.tags_to_text(tags)), 'A')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists memory_blocks_user_idx on public.memory_blocks (user_id, updated_at desc);
create index if not exists memory_blocks_search_idx on public.memory_blocks using gin (search);
create index if not exists memory_blocks_tags_idx on public.memory_blocks using gin (tags);

-- ---------------------------------------------------------------------
-- diary_entries — diario privado (contenido cifrado AES-256-GCM)
-- ---------------------------------------------------------------------
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null default current_date,
  content_ciphertext text,
  summary text,
  sentiment numeric check (sentiment between -1 and 1),
  emotions text[] not null default '{}',
  key_events jsonb not null default '[]'::jsonb,
  thoughts jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  input_mode text not null default 'text' check (input_mode in ('text', 'voice')),
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists diary_entries_user_date_idx on public.diary_entries (user_id, entry_date desc);
create index if not exists diary_entries_emotions_idx on public.diary_entries using gin (emotions);
create index if not exists diary_entries_tags_idx on public.diary_entries using gin (tags);

-- ---------------------------------------------------------------------
-- quick_notes
-- ---------------------------------------------------------------------
create table if not exists public.quick_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  category text not null default 'quick_notes',
  pinned boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists quick_notes_user_idx on public.quick_notes (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- whatsapp_imports
-- ---------------------------------------------------------------------
create table if not exists public.whatsapp_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  chat_name text,
  participants text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'parsing', 'saving', 'done', 'error')),
  progress integer not null default 0 check (progress between 0 and 100),
  total_messages integer not null default 0,
  imported_messages integer not null default 0,
  media_count integer not null default 0,
  first_message_at timestamptz,
  last_message_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- photos — memoria visual (Claude Vision)
-- ---------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text,
  description text,
  ocr_text text,
  objects text[] not null default '{}',
  faces_count integer not null default 0,
  exif jsonb not null default '{}'::jsonb,
  lat double precision,
  lng double precision,
  taken_at timestamptz,
  memory_block_id uuid references public.memory_blocks (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'analyzing', 'done', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- voice_prefs
-- ---------------------------------------------------------------------
create table if not exists public.voice_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  voice_key text not null default 'british_original'
    check (voice_key in ('british_original', 'young_brother', 'deep_calm', 'spanish_brother')),
  rate numeric not null default 1.0,
  volume numeric not null default 1.0,
  wake_word text,
  clap_threshold numeric not null default 0.35,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- connectors_tokens — apps y hogar inteligente (tokens cifrados)
-- ---------------------------------------------------------------------
create table if not exists public.connectors_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  kind text not null default 'app' check (kind in ('app', 'home')),
  enabled boolean not null default false,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'pending', 'connected', 'error', 'mock')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, provider)
);

-- ---------------------------------------------------------------------
-- smart_home_devices
-- ---------------------------------------------------------------------
create table if not exists public.smart_home_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  external_id text not null,
  name text not null,
  room text,
  type text not null default 'light' check (type in ('light', 'plug', 'ac', 'switch', 'sensor', 'speaker', 'tv')),
  state jsonb not null default '{}'::jsonb,
  online boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, provider, external_id)
);

create table if not exists public.home_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  cron text not null,
  timezone text not null default 'UTC',
  command text not null,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- shortcuts
-- ---------------------------------------------------------------------
create table if not exists public.shortcuts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger_phrase text not null,
  action text not null,
  params jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- subscriptions (historial de pagos / planes)
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('free', 'pro_lite', 'pro', 'founder', 'pro_lifetime')),
  period text not null check (period in ('monthly', 'yearly', 'lifetime')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  provider text not null check (provider in ('stripe', 'paypal', 'code', 'owner', 'mock')),
  provider_subscription_id text,
  discount_code text,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- user_locations
-- ---------------------------------------------------------------------
create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  method text not null check (method in ('auto', 'manual', 'maps_link')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  formatted_address text,
  country text,
  state text,
  city text,
  address_line text,
  timezone text,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists user_locations_primary_idx
  on public.user_locations (user_id) where is_primary and deleted_at is null;

-- ---------------------------------------------------------------------
-- world_monitor_settings + world_alerts
-- ---------------------------------------------------------------------
create table if not exists public.world_monitor_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  quake_enabled boolean not null default true,
  min_magnitude numeric not null default 4.5 check (min_magnitude between 3.0 and 8.0),
  radius_km integer not null default 500 check (radius_km between 50 and 2000),
  check_interval_minutes integer not null default 2,
  alert_sound text not null default 'siren',
  weather_enabled boolean not null default true,
  air_quality_enabled boolean not null default true,
  aqi_threshold integer not null default 4 check (aqi_threshold between 1 and 5),
  seen_event_ids text[] not null default '{}',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.world_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('earthquake', 'weather', 'air_quality')),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  external_id text,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, kind, external_id)
);

-- ---------------------------------------------------------------------
-- ai_provider_keys — claves ilimitadas por proveedor (cifradas)
-- ---------------------------------------------------------------------
create table if not exists public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini', 'groq', 'openrouter')),
  label text,
  key_ciphertext text not null,
  key_last4 text not null,
  enabled boolean not null default true,
  fail_count integer not null default 0,
  last_error text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- chat_messages — historial del cerebro (recuerda todo)
-- ---------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  provider text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- push_subscriptions — Web Push (recordatorio de diario, alertas)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- discount_codes + discount_redemptions
-- ---------------------------------------------------------------------
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) between 3 and 40),
  percent_off integer not null check (percent_off between 10 and 100),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0,
  valid_until timestamptz,
  duration text not null default 'forever' check (duration in ('once', 'repeating', 'forever', 'lifetime')),
  grants_plan text check (grants_plan in ('pro_lite', 'pro', 'founder', 'pro_lifetime')),
  grants_period text check (grants_period in ('monthly', 'yearly', 'lifetime')),
  created_by text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null references public.discount_codes (code) on update cascade,
  redeemed_at timestamptz not null default now(),
  unique (user_id, code)
);

-- ---------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'users','user_core_memory','memory_blocks','diary_entries','quick_notes','whatsapp_imports',
    'photos','voice_prefs','connectors_tokens','smart_home_devices','home_automations','shortcuts',
    'subscriptions','user_locations','world_monitor_settings','world_alerts','ai_provider_keys',
    'chat_messages','push_subscriptions','discount_codes'
  ] loop
    execute format('alter table public.%I add column if not exists server_updated_at timestamptz not null default now()', t);
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before insert or update on public.%I
                    for each row execute function public.touch_updated_at()', t, t);
    if t not in ('discount_codes') then
      execute format('create index if not exists %I_sync_idx on public.%I (user_id, server_updated_at)', t, t);
    end if;
  end loop;
end $$;

drop trigger if exists users_protect on public.users;
create trigger users_protect before update on public.users
  for each row execute function public.protect_user_billing_fields();
drop trigger if exists users_protect_insert on public.users;
create trigger users_protect_insert before insert on public.users
  for each row execute function public.protect_user_billing_fields_insert();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.users where id = auth.uid()), false);
$$;

alter table public.users enable row level security;
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users for select using (id = auth.uid());
drop policy if exists users_self_insert on public.users;
create policy users_self_insert on public.users for insert with check (id = auth.uid());
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'user_core_memory','memory_blocks','diary_entries','quick_notes','whatsapp_imports','photos',
    'voice_prefs','connectors_tokens','smart_home_devices','home_automations','shortcuts',
    'user_locations','world_monitor_settings','world_alerts','ai_provider_keys','chat_messages',
    'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_owner_all on public.%I', t, t);
    execute format('create policy %I_owner_all on public.%I for all
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- subscriptions: el usuario solo lee; escribe el backend (webhooks Stripe/PayPal).
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_self_select on public.subscriptions;
create policy subscriptions_self_select on public.subscriptions for select using (user_id = auth.uid());

-- discount_codes: nadie puede listarlos salvo el propietario (evita enumerar códigos).
alter table public.discount_codes enable row level security;
drop policy if exists discount_codes_owner_all on public.discount_codes;
create policy discount_codes_owner_all on public.discount_codes for all
  using (public.is_owner()) with check (public.is_owner());

alter table public.discount_redemptions enable row level security;
drop policy if exists discount_redemptions_self_select on public.discount_redemptions;
create policy discount_redemptions_self_select on public.discount_redemptions for select
  using (user_id = auth.uid() or public.is_owner());

-- ---------------------------------------------------------------------
-- Canje atómico de códigos (evita condiciones de carrera en used_count)
-- ---------------------------------------------------------------------
create or replace function public.redeem_discount_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.discount_codes%rowtype;
  v_user uuid := auth.uid();
  v_plan text;
  v_period text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into c from public.discount_codes
   where code = upper(trim(p_code))
     and is_active
     and (valid_until is null or valid_until > now())
     and (max_uses is null or used_count < max_uses)
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if exists (select 1 from public.discount_redemptions where user_id = v_user and code = c.code) then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  -- Los códigos < 100% solo se validan aquí; se consumen al completar el pago (webhook).
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
         subscription_status = 'active',
         is_owner = is_owner or (c.code = 'PANCHAN100')
   where id = v_user;

  return jsonb_build_object('ok', true, 'code', c.code, 'percent_off', 100,
                            'plan', v_plan, 'period', v_period, 'applied', true);
end $$;

revoke all on function public.redeem_discount_code(text) from public;
grant execute on function public.redeem_discount_code(text) to authenticated;

-- Plazas Founder (primeros 500)
create or replace function public.founder_slots_left()
returns integer language sql stable security definer set search_path = public as $$
  select greatest(0, 500 - (select count(*)::int from public.subscriptions
                            where plan = 'founder' and status = 'active'));
$$;
grant execute on function public.founder_slots_left() to anon, authenticated;

-- Búsqueda full-text de memorias
create or replace function public.search_memory_blocks(p_query text, p_limit int default 30)
returns setof public.memory_blocks language sql stable as $$
  select * from public.memory_blocks
   where user_id = auth.uid() and deleted_at is null
     and search @@ websearch_to_tsquery('spanish', p_query)
   order by ts_rank(search, websearch_to_tsquery('spanish', p_query)) desc
   limit p_limit;
$$;

-- ---------------------------------------------------------------------
-- Realtime: todas las tablas sincronizadas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'users','user_core_memory','memory_blocks','diary_entries','quick_notes','whatsapp_imports',
    'photos','voice_prefs','connectors_tokens','smart_home_devices','home_automations','shortcuts',
    'subscriptions','user_locations','world_monitor_settings','world_alerts','ai_provider_keys',
    'chat_messages','discount_codes','discount_redemptions'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Storage (privado, carpeta por usuario)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false), ('audio', 'audio', false), ('imports', 'imports', false)
on conflict (id) do nothing;

drop policy if exists "jarvis_storage_own_folder" on storage.objects;
create policy "jarvis_storage_own_folder" on storage.objects for all
  using (bucket_id in ('photos', 'audio', 'imports') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('photos', 'audio', 'imports') and (storage.foldername(name))[1] = auth.uid()::text);
