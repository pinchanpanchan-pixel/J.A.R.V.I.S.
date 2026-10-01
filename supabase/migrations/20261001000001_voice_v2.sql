-- =====================================================================
-- v2 · Fase 2 — Voz, activación y cerebro
--  * Las palmadas pasan a ser opcionales (desactivadas por defecto): J.A.R.V.I.S.
--    solo se activa con su nombre o sus frases. Se desactivan también en las cuentas
--    existentes (cada uno puede volver a activarlas en Ajustes).
--  * Conversación proactiva: saludo y parte del tiempo por la mañana.
--  * Voz del dueño: huella de voz (vector de características, NO el audio) para
--    responder solo a quien la grabó.
-- =====================================================================

alter table public.users alter column wake_clap_enabled set default false;
update public.users set wake_clap_enabled = false where wake_clap_enabled;

alter table public.users
  add column if not exists proactive_enabled boolean not null default true,
  add column if not exists morning_brief_enabled boolean not null default true;

alter table public.voice_prefs
  add column if not exists voiceprint jsonb,
  add column if not exists voiceprint_threshold numeric not null default 0.82
    check (voiceprint_threshold between 0.5 and 0.99),
  add column if not exists owner_voice_only boolean not null default false;
