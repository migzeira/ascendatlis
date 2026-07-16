// faceit-oauth-start: gera state + PKCE, persiste em oauth_states, devolve authorize_url.
import { cors, json, requireEnv } from "../_shared/cors.ts";
import { adminClient, getCaller } from "../_shared/supabase.ts";
import { base64UrlEncode, sha256 } from "../_shared/crypto.ts";
import { faceitProvider } from "../_shared/providers/faceit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    requireEnv("FACEIT_CLIENT_ID"); // falha explícita se faltar
    const { userId } = await getCaller(req);

    const state = crypto.randomUUID();
    const verifierBytes = crypto.getRandomValues(new Uint8Array(48));
    const codeVerifier = base64UrlEncode(verifierBytes);
    const challenge = base64UrlEncode(await sha256(codeVerifier));

    const admin = adminClient();
    const { error } = await admin.from("oauth_states").insert({
      state,
      user_id: userId,
      provider: "faceit",
      code_verifier: codeVerifier,
    });
    if (error) return json({ error: error.message }, 500);

    const url = faceitProvider.buildAuthorizeUrl({ state, codeChallenge: challenge });
    return json({ authorize_url: url });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: e instanceof Error ? e.message : "internal" }, 500);
  }
});
