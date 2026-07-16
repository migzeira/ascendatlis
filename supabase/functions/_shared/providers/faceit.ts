// Provider FACEIT — todo campo específico da FACEIT fica confinado aqui.
// Nenhum consumidor toca chaves com espaço/percent ou URLs `accounts.faceit.com`.
import { requireEnv } from "../cors.ts";
import type {
  NormalizedMatch,
  NormalizedMatchStats,
  Provider,
} from "./types.ts";

const AUTHORIZE_URL = "https://accounts.faceit.com/";
const TOKEN_URL = "https://api.faceit.com/auth/v1/oauth/token";
const USERINFO_URL = "https://api.faceit.com/auth/v1/resources/userinfo";
const DATA_BASE = "https://open.faceit.com/data/v4";

function basicAuth(): string {
  const id = requireEnv("FACEIT_CLIENT_ID");
  const secret = requireEnv("FACEIT_CLIENT_SECRET");
  return "Basic " + btoa(`${id}:${secret}`);
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normHeadshotPct(v: unknown): { pct: number; missing: boolean } {
  const n = num(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { pct: 0, missing: true };
  return { pct: n, missing: false };
}

// §6 helpers — versão local pra rating por partida.
function normBand(x: number, low: number, mid: number, high: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= low) return 0;
  if (x >= high) return 1;
  if (x <= mid) return (0.5 * (x - low)) / (mid - low);
  return 0.5 + (0.5 * (x - mid)) / (high - mid);
}

function ratingApprox(input: {
  kr: number;
  adr: number;
  kd: number;
  hs_pct: number;
  hs_missing: boolean;
  adr_missing: boolean;
}): number | null {
  const parts: Array<{ w: number; v: number }> = [
    { w: 0.45, v: normBand(input.kr, 0.5, 0.68, 0.85) },
    { w: 0.2, v: normBand(input.kd, 0.8, 1.05, 1.35) },
  ];
  if (!input.adr_missing) parts.push({ w: 0.25, v: normBand(input.adr, 55, 75, 95) });
  if (!input.hs_missing) parts.push({ w: 0.1, v: normBand(input.hs_pct, 35, 48, 60) });
  if (parts.length < 2) return null;
  const sumW = parts.reduce((a, p) => a + p.w, 0);
  const sum = parts.reduce((a, p) => a + p.w * p.v, 0);
  return sum / sumW;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (res.status === 429) {
    const err = new Error("faceit_rate_limited");
    (err as unknown as { status: number }).status = 429;
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`faceit ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [2000, 4000, 8000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if (status !== 429 || attempt === delays.length) throw e;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr;
}

export const faceitProvider: Provider = {
  id: "faceit",

  buildAuthorizeUrl({ state, codeChallenge }) {
    // FACEIT NÃO aceita redirect_uri nem scope como query params.
    const clientId = requireEnv("FACEIT_CLIENT_ID");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, codeVerifier }) {
    // client_secret_basic — credenciais só no header, nunca no body.
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`token_exchange_failed ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? null,
      expires_in: json.expires_in ?? null,
    };
  },

  async fetchIdentity(accessToken) {
    const info = (await fetchJson(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })) as { guid?: string; sub?: string; nickname?: string };
    const guid = info.guid ?? info.sub;
    if (!guid) throw new Error("no_guid");
    return { provider_user_id: guid, nickname: info.nickname ?? null };
  },

  async fetchAllMatches(providerUserId) {
    const apiKey = requireEnv("FACEIT_API_KEY");
    const headers = { Authorization: `Bearer ${apiKey}` };

    // 1) History — paginado; `from` SEMPRE presente.
    type HistItem = {
      match_id: string;
      finished_at?: number;
      started_at?: number;
      competition_type?: string;
      game_id?: string;
      i1?: string; // mapa em alguns payloads
    };
    const hist: HistItem[] = [];
    let from = 0;
    const pageSize = 100;
    while (true) {
      const url =
        `${DATA_BASE}/players/${providerUserId}/history` +
        `?game=cs2&from=${from}&limit=${pageSize}`;
      const page = (await withBackoff(() => fetchJson(url, { headers }))) as {
        items?: HistItem[];
      };
      const items = page.items ?? [];
      hist.push(...items);
      if (items.length < pageSize) break;
      from += pageSize;
      if (from >= 2000) break; // sanity: histórico muito longo
    }

    // 2) Bulk stats — 1 chamada por 100.
    type StatItem = {
      stats: Record<string, string>;
    };
    const statsByMatch = new Map<string, Record<string, string>>();
    from = 0;
    while (true) {
      const url =
        `${DATA_BASE}/players/${providerUserId}/games/cs2/stats` +
        `?offset=${from}&limit=${pageSize}`;
      const page = (await withBackoff(() => fetchJson(url, { headers }))) as {
        items?: StatItem[];
      };
      const items = page.items ?? [];
      for (const it of items) {
        const mid = it.stats?.["Match Id"] ?? it.stats?.["MatchId"];
        if (mid) statsByMatch.set(String(mid), it.stats);
      }
      if (items.length < pageSize) break;
      from += pageSize;
      if (from >= 2000) break;
    }

    const matches: NormalizedMatch[] = [];
    const stats: NormalizedMatchStats[] = [];

    for (const h of hist) {
      const s = statsByMatch.get(h.match_id);
      if (!s) continue; // sem stats disponíveis → pula (não inventa)

      const kills = num(s["Kills"]);
      const deaths = num(s["Deaths"]);
      const assists = num(s["Assists"]);
      const mvps = num(s["MVPs"]);
      const rounds = num(s["Rounds"]);
      const headshots = num(s["Headshots"]);
      const { pct: hsPct, missing: hsMissing } = normHeadshotPct(s["Headshots %"]);
      const kd = num(s["K/D Ratio"]);
      const kr = num(s["K/R Ratio"]);
      const adrRaw = s["ADR"] ?? s["Average Damage per Round"];
      const adrMissing = adrRaw === undefined || adrRaw === null || adrRaw === "";
      const adr = adrMissing ? 0 : num(adrRaw);
      const won = String(s["Result"]) === "1";

      // Mapa: prioriza stats
      const map = (s["Map"] ?? h.i1 ?? null) as string | null;

      // Rounds W/L: "Score" costuma vir como "13 / 8" no time do player;
      // caímos em win/loss/draw pra evitar inventar.
      let roundsWon: number | null = null;
      let roundsLost: number | null = null;
      const score = s["Score"] ?? s["Rounds Score"];
      if (typeof score === "string" && /^\s*\d+\s*\/\s*\d+\s*$/.test(score)) {
        const [a, b] = score.split("/").map((x) => Number(x.trim()));
        if (Number.isFinite(a) && Number.isFinite(b)) {
          roundsWon = won ? Math.max(a, b) : Math.min(a, b);
          roundsLost = won ? Math.min(a, b) : Math.max(a, b);
        }
      }

      const playedAtSec = h.finished_at ?? h.started_at ?? 0;
      const playedAt = new Date(playedAtSec * 1000).toISOString();
      const duration =
        h.finished_at && h.started_at ? h.finished_at - h.started_at : null;

      let result: "win" | "loss" | "draw" = won ? "win" : "loss";
      if (
        roundsWon !== null &&
        roundsLost !== null &&
        roundsWon === roundsLost
      ) {
        result = "draw";
      }

      matches.push({
        match_id: h.match_id,
        game: "cs2",
        map,
        competition_type: h.competition_type ?? null,
        played_at: playedAt,
        duration_seconds: duration,
        rounds_won: roundsWon,
        rounds_lost: roundsLost,
        result,
        raw: { history: h, stats: s },
      });

      const rating = ratingApprox({
        kr,
        adr,
        kd,
        hs_pct: hsPct,
        hs_missing: hsMissing,
        adr_missing: adrMissing,
      });

      stats.push({
        match_id: h.match_id,
        kills,
        deaths,
        assists,
        mvps,
        rounds,
        headshots,
        headshot_pct: hsPct,
        kd_ratio: kd,
        kr_ratio: kr,
        adr,
        adr_missing: adrMissing,
        rating_approx: rating,
        won,
      });
    }

    return { matches, stats };
  },
};
