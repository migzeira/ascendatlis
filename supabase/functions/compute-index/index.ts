// compute-index: wrapper HTTP para reprocessar o Index do usuário autenticado.
import { cors, json } from "../_shared/cors.ts";
import { adminClient, getCaller } from "../_shared/supabase.ts";
import { computeIndex } from "../_shared/index-engine.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { userId } = await getCaller(req);
    const out = await computeIndex(adminClient(), userId);
    return json({ ok: true, inserted: out.inserted });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: e instanceof Error ? e.message : "internal" }, 500);
  }
});
