// faceit-sync: puxa histórico + stats bulk da FACEIT, upserta em matches/match_stats,
// roda o motor. Não descriptografa token do usuário — dados são via FACEIT_API_KEY.
import { cors, json } from "../_shared/cors.ts";
import { adminClient, getCaller } from "../_shared/supabase.ts";
import { faceitProvider } from "../_shared/providers/faceit.ts";
import { computeIndex } from "../_shared/index-engine.ts";

async function runSync(userId: string): Promise<Response> {
  const admin = adminClient();

  const { data: account } = await admin
    .from("connected_accounts")
    .select("id, provider_user_id")
    .eq("user_id", userId)
    .eq("provider", "faceit")
    .maybeSingle();
  if (!account) return json({ error: "no_faceit_account" }, 404);

  // Pega job pending ou cria; se já tem running/pending → 409.
  const { data: pendingJob } = await admin
    .from("sync_jobs")
    .select("id, status")
    .eq("user_id", userId)
    .eq("provider", "faceit")
    .in("status", ["pending", "running"])
    .maybeSingle();

  let jobId: string;
  if (pendingJob) {
    if (pendingJob.status === "running") {
      return json({ error: "sync_in_progress" }, 409);
    }
    jobId = pendingJob.id;
    await admin
      .from("sync_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);
  } else {
    const { data: created, error: cErr } = await admin
      .from("sync_jobs")
      .insert({
        user_id: userId,
        provider: "faceit",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (cErr || !created) return json({ error: cErr?.message ?? "job_create" }, 500);
    jobId = created.id;
  }

  try {
    const { matches, stats } = await faceitProvider.fetchAllMatches(
      account.provider_user_id,
    );

    // Upsert matches.
    if (matches.length) {
      const rows = matches.map((m) => ({
        user_id: userId,
        provider: "faceit",
        match_id: m.match_id,
        game: m.game,
        map: m.map,
        competition_type: m.competition_type,
        played_at: m.played_at,
        duration_seconds: m.duration_seconds,
        rounds_won: m.rounds_won,
        rounds_lost: m.rounds_lost,
        result: m.result,
        raw: m.raw,
      }));
      const { error: mErr } = await admin
        .from("matches")
        .upsert(rows, { onConflict: "user_id,provider,match_id" });
      if (mErr) throw new Error(mErr.message);
    }

    if (stats.length) {
      const rows = stats.map((s) => ({
        match_id: s.match_id,
        user_id: userId,
        kills: s.kills,
        deaths: s.deaths,
        assists: s.assists,
        mvps: s.mvps,
        rounds: s.rounds,
        headshots: s.headshots,
        headshot_pct: s.headshot_pct,
        kd_ratio: s.kd_ratio,
        kr_ratio: s.kr_ratio,
        adr: s.adr,
        // rating_approx null → grava 0 (coluna NOT NULL default 0);
        // motor filtra por match_stats.rating_approx > 0? Não — usa direto.
        // Pra manter fidelidade, quando null, gravamos 0 e adr_missing.
        rating_approx: s.rating_approx ?? 0,
        won: s.won,
      }));
      const { error: sErr } = await admin
        .from("match_stats")
        .upsert(rows, { onConflict: "match_id" });
      if (sErr) throw new Error(sErr.message);
    }

    await computeIndex(admin, userId);

    await admin
      .from("sync_jobs")
      .update({
        status: "success",
        matches_synced: matches.length,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    await admin
      .from("connected_accounts")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", account.id);

    return json({ ok: true, matches_synced: matches.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync_failed";
    await admin
      .from("sync_jobs")
      .update({
        status: "error",
        error: msg,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return json({ error: msg }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    // Suporta 2 modos: chamada do usuário (bearer) e chamada interna do sync-all
    // (service_role + body { user_id }).
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
      const body = await req.json().catch(() => ({}));
      const uid = (body as { user_id?: string }).user_id;
      if (!uid) return json({ error: "missing_user_id" }, 400);
      return await runSync(uid);
    }
    const { userId } = await getCaller(req);
    return await runSync(userId);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: e instanceof Error ? e.message : "internal" }, 500);
  }
});
