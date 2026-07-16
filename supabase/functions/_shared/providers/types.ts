// Interface neutra de provider. Nenhum campo específico de FACEIT deve
// vazar pra fora deste diretório — as edge functions consomem só isto.

export type ProviderId = "faceit";

export interface NormalizedMatch {
  match_id: string;
  game: string; // 'cs2'
  map: string | null;
  competition_type: string | null;
  played_at: string; // ISO
  duration_seconds: number | null;
  rounds_won: number | null;
  rounds_lost: number | null;
  result: "win" | "loss" | "draw";
  raw: unknown;
}

export interface NormalizedMatchStats {
  match_id: string;
  kills: number;
  deaths: number;
  assists: number;
  mvps: number;
  rounds: number;
  headshots: number;
  headshot_pct: number; // 0-100
  kd_ratio: number;
  kr_ratio: number;
  adr: number; // pode vir 0 se ausente
  adr_missing: boolean;
  rating_approx: number | null; // null quando faltam métricas demais
  won: boolean;
}

export interface Provider {
  id: ProviderId;
  // Constrói URL de authorize + PKCE state.
  buildAuthorizeUrl(args: { state: string; codeChallenge: string }): string;
  // Troca code por tokens.
  exchangeCode(args: {
    code: string;
    codeVerifier: string;
  }): Promise<{
    access_token: string;
    refresh_token: string | null;
    expires_in: number | null;
  }>;
  // Descobre o provider_user_id (guid) e nickname a partir do access_token.
  fetchIdentity(accessToken: string): Promise<{
    provider_user_id: string;
    nickname: string | null;
  }>;
  // Puxa todas as partidas + stats de CS2 do player, já normalizadas.
  fetchAllMatches(providerUserId: string): Promise<{
    matches: NormalizedMatch[];
    stats: NormalizedMatchStats[];
  }>;
}
