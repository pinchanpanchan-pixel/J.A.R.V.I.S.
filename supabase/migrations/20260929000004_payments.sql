-- Consumo de códigos < 100 % tras un pago confirmado (lo llama el webhook con service_role).
create or replace function public.consume_discount_code(p_user uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare c public.discount_codes%rowtype;
begin
  select * into c from public.discount_codes
   where code = upper(trim(p_code)) and is_active
     and (valid_until is null or valid_until > now())
     and (max_uses is null or used_count < max_uses)
   for update;
  if not found then return false; end if;
  insert into public.discount_redemptions (user_id, code) values (p_user, c.code) on conflict (user_id, code) do nothing;
  if found then
    update public.discount_codes set used_count = used_count + 1 where id = c.id;
  end if;
  return true;
end $$;

revoke all on function public.consume_discount_code(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_discount_code(uuid, text) to service_role;

-- Precio pagado y referencia para evitar dobles activaciones por el mismo pago.
create unique index if not exists subscriptions_provider_ref_idx
  on public.subscriptions (provider, provider_subscription_id) where provider_subscription_id is not null;
