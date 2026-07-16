import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_.-]{1,28}[a-z0-9])$/;

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Mínimo 3 caracteres.")
  .max(30, "Máximo 30 caracteres.")
  .transform((s) => s.toLowerCase())
  .refine((s) => USERNAME_RE.test(s), {
    message: "Use letras, números, _, . ou -. Não pode começar/terminar com pontuação.",
  });

/** Devolve o profile do usuário autenticado. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_public")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

/** Confere se um username está disponível (case-insensitive). */
export const checkUsernameAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ username: usernameSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing, error } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!existing) return { available: true, username: data.username };
    return { available: existing.id === context.userId, username: data.username };
  });

/** Update parcial de profile. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        username: usernameSchema.optional(),
        display_name: z.string().trim().max(60).nullable().optional(),
        avatar_url: z.string().trim().url().max(500).nullable().optional(),
        is_public: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.username) {
      const { data: existing } = await context.supabase
        .from("profiles")
        .select("id")
        .eq("username", data.username)
        .maybeSingle();
      if (existing && existing.id !== context.userId) {
        throw new Error("Este nome de usuário já está em uso.");
      }
    }
    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update({
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.display_name !== undefined ? { display_name: data.display_name } : {}),
        ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
        ...(data.is_public !== undefined ? { is_public: data.is_public } : {}),
      })
      .eq("id", context.userId)
      .select("id, username, display_name, avatar_url, is_public")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

/** Último sync_job do usuário (para polling do onboarding). */
export const getLatestSyncJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sync_jobs")
      .select("id, status, matches_synced, error, started_at, finished_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });
