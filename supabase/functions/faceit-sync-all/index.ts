// faceit-sync-all: orquestrador do cron. Requer service_role no header.
// Itera contas em série; skip se já houver job ativo.
import { cors, json, requireEnv } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${serviceKey}`) {
    return json({ error: "forbidden" }, 403);
  }

  const admin = adminClient();
  const { data: accounts } = await admin
    .from("connected_accounts")
    .select("user_id")
    .eq("provider", "faceit")
    .eq("needs_reauth", false);

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const syncUrl = `${supabaseUrl}/functions/v1/faceit-sync`;

  let ran = 0;
  let skipped = 0;
  for (const a of (accounts ?? []) as Array<{ user_id: string }>) {
    const { data: active } = await admin
      .from("sync_jobs")
      .select("id")
      .eq("user_id", a.user_id)
      .eq("provider", "faceit")
      .in("status", ["pending", "running"])
      .maybeSingle();
    if (active) {
      skipped++;
      continue;
    }
    try {
      await fetch(syncUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: a.user_id }),
      });
      ran++;
    } catch {
      skipped++;
    }
  }

  return json({ ran, skipped });
});
