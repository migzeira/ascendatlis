import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Retorna todos os dados que o /dashboard precisa em uma chamada.
 * Sem seed, sem fallback: campos ausentes vêm como null e a UI trata o estado.
 */
export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const [connectionRes, latestSnapRes, seriesRes, matchesRes, jobRes] = await Promise.all([
      supabase
        .from("connected_accounts")
        .select("id, provider_user_id, nickname, connected_at, last_synced_at, needs_reauth")
        .eq("user_id", userId)
        .eq("provider", "faceit")
        .maybeSingle(),
      supabase
        .from("index_snapshots")
        .select(
          "id, total_score, performance_score, consistency_score, evolution_score, participation_score, matches_considered, is_calibrating, breakdown, computed_at",
        )
        .eq("user_id", userId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("index_snapshots")
        .select("total_score, computed_at, is_calibrating")
        .eq("user_id", userId)
        .eq("is_calibrating", false)
        .order("computed_at", { ascending: true })
        .limit(200),
      supabase
        .from("matches")
        .select(
          "match_id, played_at, map, result, rounds_won, rounds_lost, competition_type",
        )
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(20),
      supabase
        .from("sync_jobs")
        .select("id, status, matches_synced, error, started_at, finished_at, created_at")
        .eq("user_id", userId)
        .eq("provider", "faceit")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (connectionRes.error) throw new Error(connectionRes.error.message);
    if (latestSnapRes.error) throw new Error(latestSnapRes.error.message);
    if (seriesRes.error) throw new Error(seriesRes.error.message);
    if (matchesRes.error) throw new Error(matchesRes.error.message);
    if (jobRes.error) throw new Error(jobRes.error.message);

    const matchIds = (matchesRes.data ?? []).map((m) => m.match_id);
    let stats: Array<{
      match_id: string;
      kills: number;
      deaths: number;
      assists: number;
      adr: number;
      kd_ratio: number;
      headshot_pct: number;
      rating_approx: number;
      won: boolean;
    }> = [];
    if (matchIds.length > 0) {
      const { data, error } = await supabase
        .from("match_stats")
        .select("match_id, kills, deaths, assists, adr, kd_ratio, headshot_pct, rating_approx, won")
        .in("match_id", matchIds);
      if (error) throw new Error(error.message);
      stats = data ?? [];
    }

    // Delta 7d: snapshot mais recente <= now - 7d (não é o próprio latest).
    let delta7d: number | null = null;
    if (latestSnapRes.data) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: old } = await supabase
        .from("index_snapshots")
        .select("total_score")
        .eq("user_id", userId)
        .lte("computed_at", sevenDaysAgo)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (old) delta7d = latestSnapRes.data.total_score - old.total_score;
    }

    return {
      connection: connectionRes.data,
      snapshot: latestSnapRes.data,
      series: seriesRes.data ?? [],
      matches: matchesRes.data ?? [],
      stats,
      job: jobRes.data,
      delta7d,
    };
  });
