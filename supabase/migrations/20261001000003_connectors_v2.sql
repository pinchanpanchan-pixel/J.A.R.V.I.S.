-- =====================================================================
-- v2 · Fase 4 — Conexiones reales
--  * En la v1 el interruptor solo marcaba «activado» sin iniciar sesión (estado pending/mock
--    sin token). Esas filas pasan a «desconectado»: ahora se conecta de verdad con OAuth.
--  * HomeKit y Contraseñas de Apple se retiran (no son posibles desde una web).
-- =====================================================================
update public.connectors_tokens
   set enabled = false, status = 'disconnected', updated_at = now()
 where status in ('pending', 'mock')
   and access_token_ciphertext is null
   and provider <> 'ios_shortcuts';

update public.connectors_tokens
   set enabled = false, status = 'disconnected', deleted_at = coalesce(deleted_at, now()), updated_at = now()
 where provider in ('homekit', 'apple_passwords');
