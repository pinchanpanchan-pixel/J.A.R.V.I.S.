import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import type { TableName } from "@/types/db";
import { RemoteError, type AnyRow, type Remote } from "./remote";

const PAGE = 1000;

/** Nube real: Supabase Postgres + Realtime. */
export class SupabaseRemote implements Remote {
  readonly kind = "supabase" as const;
  constructor(private readonly sb: SupabaseClient) {}

  async pull(table: TableName, userId: string, since: string | null): Promise<AnyRow[]> {
    const out: AnyRow[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = this.sb
        .from(table)
        .select("*")
        .eq(table === "users" ? "id" : "user_id", userId)
        .order("server_updated_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (since) q = q.gt("server_updated_at", since);
      const { data, error } = await q;
      if (error) throw new RemoteError(error.message, isRetryable(error));
      out.push(...((data ?? []) as AnyRow[]));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  async push(table: TableName, row: AnyRow): Promise<void> {
    const payload = { ...row };
    delete payload.server_updated_at;
    delete payload.search; // columna generada (memory_blocks)
    const { error } = await this.sb.from(table).upsert(payload, { onConflict: "id" });
    if (error) throw new RemoteError(`${table}: ${error.message}`, isRetryable(error));
  }

  subscribe(
    userId: string,
    tables: TableName[],
    onChange: (table: TableName, row: AnyRow) => void,
    onStatus?: (connected: boolean) => void,
  ): () => void {
    let channel: RealtimeChannel = this.sb.channel(`jarvis-sync-${userId}`);
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table,
          filter: `${table === "users" ? "id" : "user_id"}=eq.${userId}`,
        },
        (payload: { new?: AnyRow; old?: AnyRow; eventType: string }) => {
          const row = payload.eventType === "DELETE" ? payload.old : payload.new;
          if (!row?.id) return;
          if (payload.eventType === "DELETE") {
            onChange(table, { ...row, user_id: userId, deleted_at: new Date().toISOString() } as AnyRow);
          } else {
            onChange(table, row);
          }
        },
      );
    }
    channel.subscribe((status) => onStatus?.(status === "SUBSCRIBED"));
    return () => {
      void this.sb.removeChannel(channel);
    };
  }
}

function isRetryable(error: { code?: string; message?: string; status?: number }): boolean {
  const code = error.code ?? "";
  // 42501 RLS, 23xxx constraint, 22xxx datos inválidos, PGRST1xx petición inválida => definitivo
  if (/^(42501|23|22|PGRST1)/.test(code)) return false;
  return true;
}
