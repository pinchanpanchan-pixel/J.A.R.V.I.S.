-- Códigos de descuento iniciales
insert into public.discount_codes
  (code, percent_off, max_uses, valid_until, duration, grants_plan, grants_period, created_by, is_active)
values
  ('PANCHAN100', 100, null, null, 'lifetime', 'pro_lifetime', 'lifetime', 'pinchan.panchan@gmail.com', true),
  ('BROTHER50',   50,  100, null, 'forever',  null,           null,       'pinchan.panchan@gmail.com', true),
  ('FRIENDS20',   20,  200, null, 'forever',  null,           null,       'pinchan.panchan@gmail.com', true),
  ('LAUNCH30',    30,  500, null, 'once',     null,           null,       'pinchan.panchan@gmail.com', true)
on conflict (code) do nothing;
