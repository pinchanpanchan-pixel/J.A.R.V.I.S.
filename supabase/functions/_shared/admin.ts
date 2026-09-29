// Cliente de Supabase con service_role (variables inyectadas por Supabase en las Edge Functions).
import { createClient } from "npm:@supabase/supabase-js@2";

export function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

/** Solo el planificador (pg_cron con la service key) o una llamada con CRON_SECRET puede ejecutarlas. */
export function authorized(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const cron = Deno.env.get("CRON_SECRET");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return (!!cron && auth === `Bearer ${cron}`) || (!!service && auth === `Bearer ${service}`);
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
