import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Kick off FACEIT OAuth: chama edge fn e retorna a authorize_url. */
export const startFaceitOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.functions.invoke(
      "faceit-oauth-start",
      { body: {} },
    );
    if (error) throw new Error(error.message);
    const url = (data as { authorize_url?: string })?.authorize_url;
    if (!url) throw new Error("edge_returned_no_url");
    return { authorize_url: url };
  });

/** Dispara sync manual (upsert matches + compute index). */
export const triggerFaceitSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.functions.invoke(
      "faceit-sync",
      { body: {} },
    );
    if (error) throw new Error(error.message);
    return data as { ok?: boolean; matches_synced?: number; error?: string };
  });

/** Retorna a conta FACEIT vinculada ao usuário atual, se houver. */
export const getFaceitConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("connected_accounts")
      .select("id, provider_user_id, nickname, connected_at, last_synced_at, needs_reauth")
      .eq("user_id", context.userId)
      .eq("provider", "faceit")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

/** Desconecta FACEIT (deleta conta; cascade limpa secrets). */
export const disconnectFaceit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("connected_accounts")
      .delete()
      .eq("user_id", context.userId)
      .eq("provider", "faceit");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
