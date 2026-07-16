// Ascend Index engine — determinístico. Lê matches/match_stats do banco
// (via service_role client) e escreve em index_snapshots com dedupe.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function normBand(x: number, low: number, mid: number, high: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= low) return 0;
  if (x >= high) return 1;
  if (x <= mid) return (0.5 * (x - low)) / (mid - low);
  return 0.5 + (0.5 * (x - mid)) / (high - mid);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdevSample(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function linSlope(ys: number[]): { slope: number; ok: boolean } {
  const n = ys.length;
  if (n < 10) return { slope: 0, ok: false };
  const xs = ys.map((_, i) => i);
  const xm = mean(xs);
  const ym = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xm) * (ys[i] - ym);
    den += (xs[i] - xm) ** 2;
  }
  if (den === 0) return { slope: 0, ok: false };
  return { slope: num / den, ok: true };
}

interface MatchRow {
  id: string;
  played_at: string;
  map: string | null;
}
interface StatsRow {
  match_id: string;
  rating_approx: number;
}

export async function computeIndex(
  admin: SupabaseClient,
  userId: string,
): Promise<{ inserted: boolean; snapshot: unknown }> {
  // Últimas 30 partidas (desc pra pegar, depois re-ordenar asc pro slope).
  const { data: mRecent, error: e1 } = await admin
    .from("matches")
    .select("id, match_id, played_at, map")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(30);
  if (e1) throw new Error(e1.message);
  const matchIds30 = (mRecent ?? []).map((r: { match_id: string }) => r.match_id);

  const { data: sAll } = matchIds30.length
    ? await admin
        .from("match_stats")
        .select("match_id, rating_approx")
        .in("match_id", matchIds30)
    : { data: [] as StatsRow[] };

  const ratingByMatch = new Map<string, number>();
  for (const s of (sAll ?? []) as StatsRow[]) {
    if (s.rating_approx !== null && Number.isFinite(Number(s.rating_approx))) {
      ratingByMatch.set(s.match_id, Number(s.rating_approx));
    }
  }

  // Reordena ASC por played_at.
  const rowsAsc = (mRecent ?? [])
    .slice()
    .reverse() as Array<{ match_id: string; played_at: string; map: string | null }>;
  const ratingsAsc: number[] = [];
  for (const r of rowsAsc) {
    const v = ratingByMatch.get(r.match_id);
    if (v !== undefined) ratingsAsc.push(v);
  }
  const nConsidered = ratingsAsc.length;

  // Pilar 1 — Performance.
  const performance = nConsidered ? mean(ratingsAsc) : 0;

  // Pilar 2 — Consistência.
  let consistency = 0.5;
  if (nConsidered >= 2) {
    const m = mean(ratingsAsc);
    if (m < 0.1) consistency = 0;
    else {
      const cv = stdevSample(ratingsAsc) / m;
      consistency = 1 - normBand(cv, 0.12, 0.24, 0.4);
    }
  }

  // Pilar 3 — Evolução.
  let evolution = 0.5;
  const { slope, ok } = linSlope(ratingsAsc);
  if (ok) evolution = normBand(slope, -0.004, 0, 0.004);

  // Pilar 4 — Participação (30 DIAS, não partidas).
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: m30d } = await admin
    .from("matches")
    .select("played_at")
    .eq("user_id", userId)
    .gte("played_at", since);
  const rows30 = (m30d ?? []) as Array<{ played_at: string }>;
  const partidas = rows30.length;
  const daySet = new Set<string>();
  for (const r of rows30) {
    // aproxima America/Sao_Paulo (UTC-3, sem DST desde 2019).
    const d = new Date(new Date(r.played_at).getTime() - 3 * 3600 * 1000);
    daySet.add(d.toISOString().slice(0, 10));
  }
  const diasAtivos = daySet.size;
  const participation =
    0.5 * normBand(diasAtivos, 2, 8, 16) +
    0.5 * normBand(partidas, 5, 25, 50);

  const total = Math.round(
    1000 *
      (0.4 * performance +
        0.25 * consistency +
        0.2 * evolution +
        0.15 * participation),
  );

  const isCalibrating = nConsidered < 10;

  // Insights determinísticos (§7).
  const insights: string[] = [];
  if (nConsidered >= 20) {
    const recent10 = ratingsAsc.slice(-10);
    const prev10 = ratingsAsc.slice(-20, -10);
    if (recent10.length === 10 && prev10.length === 10) {
      const mR = mean(recent10);
      const mP = mean(prev10);
      if (mP > 0) {
        const delta = (mR - mP) / mP;
        if (Math.abs(delta) >= 0.05) {
          insights.push(
            `Seu rating médio ${delta > 0 ? "subiu" : "caiu"} ${Math.round(
              Math.abs(delta) * 100,
            )}% nas últimas 10 partidas.`,
          );
        }
      }
    }
  }
  if (nConsidered >= 2) {
    const m = mean(ratingsAsc);
    if (m >= 0.1) {
      const cv = stdevSample(ratingsAsc) / m;
      if (cv < 0.12) insights.push("Você está jogando de forma muito consistente.");
      else if (cv > 0.4) insights.push("Sua performance está oscilando acima do normal.");
    }
  }
  // Mapa favorito nos últimos 30 dias.
  if (rows30.length >= 3) {
    const { data: m30full } = await admin
      .from("matches")
      .select("match_id, map")
      .eq("user_id", userId)
      .gte("played_at", since);
    const byMap = new Map<string, { count: number; ratings: number[] }>();
    for (const r of ((m30full ?? []) as Array<{ match_id: string; map: string | null }>)) {
      if (!r.map) continue;
      const rat = ratingByMatch.get(r.match_id);
      const cur = byMap.get(r.map) ?? { count: 0, ratings: [] };
      cur.count++;
      if (rat !== undefined) cur.ratings.push(rat);
      byMap.set(r.map, cur);
    }
    let best: { map: string; avg: number } | null = null;
    for (const [map, v] of byMap) {
      if (v.count >= 3 && v.ratings.length) {
        const avg = mean(v.ratings);
        if (!best || avg > best.avg) best = { map, avg };
      }
    }
    if (best) {
      insights.push(
        `Seu melhor mapa do mês foi ${best.map} (rating médio ${best.avg.toFixed(2)}).`,
      );
    }
  }
  insights.push(
    `Você jogou ${partidas} partidas em ${diasAtivos} dias ativos nos últimos 30 dias.`,
  );

  const breakdown = {
    pillars: {
      performance,
      consistency,
      evolution,
      participation,
    },
    inputs: {
      matches_considered: nConsidered,
      partidas_30d: partidas,
      dias_ativos_30d: diasAtivos,
      slope,
    },
    insights: insights.slice(0, 3),
  };

  if (nConsidered === 0) return { inserted: false, snapshot: null };

  // Dedupe: compara com último.
  const round4 = (x: number) => Math.round(x * 10000) / 10000;
  const { data: last } = await admin
    .from("index_snapshots")
    .select(
      "matches_considered, total_score, performance_score, consistency_score, evolution_score, participation_score",
    )
    .eq("user_id", userId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    last &&
    last.matches_considered === nConsidered &&
    Math.round(Number(last.total_score)) === total &&
    round4(Number(last.performance_score)) === round4(performance) &&
    round4(Number(last.consistency_score)) === round4(consistency) &&
    round4(Number(last.evolution_score)) === round4(evolution) &&
    round4(Number(last.participation_score)) === round4(participation)
  ) {
    return { inserted: false, snapshot: last };
  }

  const { data: inserted, error: insErr } = await admin
    .from("index_snapshots")
    .insert({
      user_id: userId,
      total_score: total,
      performance_score: performance,
      consistency_score: consistency,
      evolution_score: evolution,
      participation_score: participation,
      matches_considered: nConsidered,
      is_calibrating: isCalibrating,
      breakdown,
    })
    .select()
    .single();
  if (insErr) throw new Error(insErr.message);
  return { inserted: true, snapshot: inserted };
}
