import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/**
 * Cliente publishable server-side. Não usa localStorage, não persiste sessão.
 * Só lê o que as policies `TO anon` liberam (perfis públicos + snapshots +
 * matches + match_stats via helper is_profile_public).
 */
function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Devolve o payload público de /p/:username.
 * - Perfil inexistente ou is_public=false → retorna null (rota chama notFound()).
 * - Nunca vaza email, avatar_url é o próprio campo público do profile.
 */
export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ username: z.string().trim().toLowerCase().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_public")
      .eq("username", data.username)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile || !profile.is_public) return null;

    const [snapRes, seriesRes, matchesRes] = await Promise.all([
      supabase
        .from("index_snapshots")
        .select(
          "total_score, performance_score, consistency_score, evolution_score, participation_score, matches_considered, is_calibrating, breakdown, computed_at",
        )
        .eq("user_id", profile.id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("index_snapshots")
        .select("total_score, computed_at")
        .eq("user_id", profile.id)
        .eq("is_calibrating", false)
        .order("computed_at", { ascending: true })
        .limit(200),
      supabase
        .from("matches")
        .select("match_id, played_at, map, result, rounds_won, rounds_lost")
        .eq("user_id", profile.id)
        .order("played_at", { ascending: false })
        .limit(10),
    ]);

    if (snapRes.error) throw new Error(snapRes.error.message);
    if (seriesRes.error) throw new Error(seriesRes.error.message);
    if (matchesRes.error) throw new Error(matchesRes.error.message);

    return {
      profile: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
      snapshot: snapRes.data,
      series: seriesRes.data ?? [],
      matches: matchesRes.data ?? [],
    };
  });
