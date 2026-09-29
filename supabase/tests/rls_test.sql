-- Tests de RLS, protección de campos y canje de códigos.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
-- En Supabase los permisos por defecto se aplican al crear la función y la migración los revoca después:
-- se reproduce ese orden para las funciones solo-backend.
revoke all on function public.consume_discount_code(uuid, text) from public, anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.com');

-- El trigger crea perfil, memoria, voz y ajustes de WorldMonitor.
do $$ begin
  assert (select count(*) from public.users) = 2, 'profiles created';
  assert (select count(*) from public.voice_prefs) = 2, 'voice prefs created';
  assert (select count(*) from public.world_monitor_settings) = 2, 'world monitor settings created';
end $$;

-- Usuario A
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

insert into public.quick_notes (user_id, content) values ('00000000-0000-0000-0000-00000000000a', 'nota A');
do $$ begin
  assert (select count(*) from public.users) = 1, 'A sees only own profile';
  assert (select count(*) from public.discount_codes) = 0, 'A cannot list discount codes';
end $$;

-- A no puede escribir filas de B
do $$ begin
  begin
    insert into public.quick_notes (user_id, content) values ('00000000-0000-0000-0000-00000000000b', 'hack');
    raise exception 'should have failed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A no puede auto-otorgarse PRO
do $$ begin
  begin
    update public.users set subscription = 'pro' where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'should have failed';
  exception when raise_exception then
    if sqlerrm = 'should have failed' then raise; end if;
  end;
end $$;

-- Pero sí cambiar ajustes normales
update public.users set floating_mode_enabled = true, diary_reminder_time = '21:15'
 where id = '00000000-0000-0000-0000-00000000000a';

-- Código inválido
do $$ begin
  assert (public.redeem_discount_code('NOPE') ->> 'error') = 'invalid_code', 'invalid code rejected';
  assert (public.redeem_discount_code('friends20') ->> 'percent_off')::int = 20, 'partial code validated';
  assert (public.redeem_discount_code('PANCHAN100') ->> 'applied')::boolean, '100% code applied';
  assert (public.redeem_discount_code('PANCHAN100') ->> 'error') = 'already_redeemed', 'no double redeem';
end $$;

do $$ begin
  assert (select subscription from public.users) = 'pro_lifetime', 'A upgraded to lifetime';
  assert (select is_owner from public.users), 'PANCHAN100 grants owner';
  -- Como propietario ya puede ver los códigos
  assert (select count(*) from public.discount_codes) = 4, 'owner sees codes';
  assert (select used_count from public.discount_codes where code = 'PANCHAN100') = 1, 'used_count incremented';
end $$;

-- Last-write-wins en servidor: una escritura antigua (dispositivo que estuvo offline) no pisa la nueva
insert into public.quick_notes (id, user_id, content, updated_at)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'v2', '2030-01-01T00:00:02Z');
insert into public.quick_notes (id, user_id, content, updated_at)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'v1-stale', '2030-01-01T00:00:01Z')
  on conflict (id) do update set content = excluded.content, updated_at = excluded.updated_at;
do $$ begin
  assert (select content from public.quick_notes where id = '10000000-0000-0000-0000-000000000001') = 'v2', 'stale write ignored';
  assert (select server_updated_at is not null from public.quick_notes where id = '10000000-0000-0000-0000-000000000001'), 'server cursor set';
end $$;
update public.quick_notes set content = 'v3', updated_at = '2030-01-01T00:00:03Z' where id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select content from public.quick_notes where id = '10000000-0000-0000-0000-000000000001') = 'v3', 'newer write applied';
end $$;

-- Usuario B no ve nada de A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.quick_notes) = 0, 'B cannot see A notes';
  assert (select count(*) from public.users) = 1, 'B sees only own profile';
  assert (select count(*) from public.discount_codes) = 0, 'B cannot list codes';
  assert public.founder_slots_left() = 500, 'founder slots';
end $$;

reset role;
\echo 'ALL DB TESTS PASSED'

-- consume_discount_code: solo el backend
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin
    perform public.consume_discount_code('00000000-0000-0000-0000-00000000000b', 'BROTHER50');
    raise exception 'should have failed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert public.consume_discount_code('00000000-0000-0000-0000-00000000000b', 'brother50'), 'consumed';
  assert public.consume_discount_code('00000000-0000-0000-0000-00000000000b', 'BROTHER50'), 'idempotent';
  assert (select used_count from public.discount_codes where code = 'BROTHER50') = 1, 'counted once';
  assert not public.consume_discount_code('00000000-0000-0000-0000-00000000000b', 'NOPE'), 'invalid';
end $$;
\echo 'PAYMENT DB TESTS PASSED'
