import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Gate autenticado. `ssr: false` porque a sessão do Supabase vive em
 * localStorage e o servidor não pode lê-la (spec §10). Rotas públicas
 * (landing, /p/:username, /privacidade, /termos, /auth) ficam fora deste
 * subtree.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { next: location.href },
      });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
