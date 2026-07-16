// faceit-oauth-callback: GET, verify_jwt=false. FACEIT redireciona pra cá.
// Troca code por tokens, descobre guid, upserta conta, criptografa tokens, enfileira sync.
import { cors, requireEnv } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { encryptToken, bytesToPgBytea } from "../_shared/crypto.ts";
import { faceitProvider } from "../_shared/providers/faceit.ts";

function appBase(): string {
  // URL pública do app (published). Configurável via secret opcional.
  return Deno.env.get("APP_PUBLIC_URL") ?? "https://ascendatlis.lovable.app";
}

function redirect(pathAndQuery: string): Response {
  const url = new URL(pathAndQuery, appBase()).toString();
  return new Response(null, {
    status: 302,
    headers: { ...cors, Location: url },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") {
    return new Response("method_not_allowed", { status: 405, headers: cors });
  }

  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    const providerError = url.searchParams.get("error");
    if (providerError) {
      return redirect(`/connect?error=${encodeURIComponent(providerError)}`);
    }
    if (!state || !code) return redirect("/connect?error=missing_params");

    const admin = adminClient();

    // 1) Recupera state.
    const { data: st } = await admin
      .from("oauth_states")
      .select("state, user_id, provider, code_verifier, expires_at")
      .eq("state", state)
      .maybeSingle();
    if (!st) return redirect("/connect?error=invalid_state");
    if (new Date(st.expires_at).getTime() < Date.now()) {
      await admin.from("oauth_states").delete().eq("state", state);
      return redirect("/connect?error=invalid_state");
    }

    // 2) Troca code por tokens (Basic auth, sem body creds).
    let tokens;
    try {
      // eslint-disable-next-line prefer-const
      tokens = await faceitProvider.exchangeCode({
        code,
        codeVerifier: st.code_verifier,
      });
    } catch (_e) {
      return redirect("/connect?error=token_exchange");
    }

    // 3) userinfo → guid.
    let identity;
    try {
      identity = await faceitProvider.fetchIdentity(tokens.access_token);
    } catch (_e) {
      return redirect("/connect?error=no_guid");
    }

    // 4) Upsert conta (verifica se guid já pertence a outro user).
    const { data: existing } = await admin
      .from("connected_accounts")
      .select("id, user_id")
      .eq("provider", "faceit")
      .eq("provider_user_id", identity.provider_user_id)
      .maybeSingle();
    if (existing && existing.user_id !== st.user_id) {
      return redirect("/connect?error=already_linked");
    }

    let accountId: string;
    if (existing) {
      accountId = existing.id;
      await admin
        .from("connected_accounts")
        .update({ nickname: identity.nickname, needs_reauth: false })
        .eq("id", accountId);
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("connected_accounts")
        .insert({
          user_id: st.user_id,
          provider: "faceit",
          provider_user_id: identity.provider_user_id,
          nickname: identity.nickname,
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        return redirect("/connect?error=account_upsert");
      }
      accountId = inserted.id;
    }

    // 5) Criptografa e grava tokens.
    requireEnv("TOKEN_ENC_KEY");
    const at = await encryptToken(tokens.access_token);
    let rtCt: string | null = null;
    let rtIv: string | null = null;
    if (tokens.refresh_token) {
      const rt = await encryptToken(tokens.refresh_token);
      rtCt = bytesToPgBytea(rt.ct);
      rtIv = bytesToPgBytea(rt.iv);
    }
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;
    const { error: secErr } = await admin.from("connected_account_secrets").upsert({
      account_id: accountId,
      access_token_ct: bytesToPgBytea(at.ct),
      access_token_iv: bytesToPgBytea(at.iv),
      refresh_token_ct: rtCt,
      refresh_token_iv: rtIv,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
    if (secErr) return redirect("/connect?error=secret_store");

    // 6) Enfileira sync (respeita unique parcial).
    const { data: activeJob } = await admin
      .from("sync_jobs")
      .select("id")
      .eq("user_id", st.user_id)
      .eq("provider", "faceit")
      .in("status", ["pending", "running"])
      .maybeSingle();
    if (!activeJob) {
      await admin
        .from("sync_jobs")
        .insert({ user_id: st.user_id, provider: "faceit", status: "pending" });
    }

    // 7) Limpa state.
    await admin.from("oauth_states").delete().eq("state", state);

    // 8) Redireciona.
    const fromOnboarding = url.searchParams.get("from") === "onboarding";
    return redirect(fromOnboarding ? "/onboarding?step=3" : "/connect?ok=1");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal";
    return redirect(`/connect?error=${encodeURIComponent(msg)}`);
  }
});
