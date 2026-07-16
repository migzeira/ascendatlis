import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { AppShell } from "@/components/ascend/AppShell";
import { Eyebrow, SectionHeader, Divider } from "@/components/ascend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — ASCEND" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_public: boolean;
}

function SettingsPage() {
  const load = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    load({}).then((p) => {
      if (!p) return;
      setProfile(p);
      setUsername(p.username);
      setDisplayName(p.display_name ?? "");
      setAvatarUrl(p.avatar_url ?? "");
      setIsPublic(p.is_public);
    });
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const payload: {
        username?: string;
        display_name?: string | null;
        avatar_url?: string | null;
        is_public?: boolean;
      } = { is_public: isPublic };
      if (profile) {
        if (username !== profile.username) payload.username = username;
        if (displayName !== (profile.display_name ?? "")) {
          payload.display_name = displayName.trim() || null;
        }
        if (avatarUrl !== (profile.avatar_url ?? "")) {
          payload.avatar_url = avatarUrl.trim() || null;
        }
      }
      const updated = (await update({ data: payload })) as Profile;
      setProfile(updated);
      setMsg("Salvo.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setErr(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Falha ${res.status}`);
      }
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao excluir conta.");
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="animate-pulse text-sm text-muted-foreground">Carregando…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <Eyebrow>01 / conta</Eyebrow>
        <h1
          className="mt-4 text-3xl leading-[1.05] tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
        >
          Ajustes.
        </h1>

        <form onSubmit={handleSave} className="mt-12 flex flex-col gap-6">
          <div>
            <Label htmlFor="username">Nome de usuário</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="mt-1.5"
              minLength={3}
              maxLength={30}
              required
            />
            <p
              className="mt-2 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              perfil público: /p/{username || "…"}
            </p>
          </div>

          <div>
            <Label htmlFor="display_name">Nome de exibição</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5"
              maxLength={60}
              placeholder="Opcional"
            />
          </div>

          <div>
            <Label htmlFor="avatar_url">URL do avatar</Label>
            <Input
              id="avatar_url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="mt-1.5"
              placeholder="https://…"
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-6">
            <div>
              <p className="text-sm text-foreground">Perfil público</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Quando ativo, sua página /p/{username} é acessível por qualquer pessoa com o link.
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
          {err ? (
            <p className="text-sm text-destructive" role="alert">
              {err}
            </p>
          ) : null}

          <Button type="submit" disabled={saving} className="h-11 self-start">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>

        <Divider className="my-16" />

        <SectionHeader number="02" title="sessão" />
        <div className="mt-6">
          <Button variant="outline" onClick={handleSignOut} className="h-11">
            Sair
          </Button>
        </div>

        <Divider className="my-16" />

        <SectionHeader number="03" title="zona de perigo" />
        <p className="mt-4 max-w-lg text-sm text-muted-foreground">
          Excluir a conta remove permanentemente sua identidade, perfil, tokens da FACEIT,
          histórico de partidas e todos os snapshots de índice. Não há backup.
        </p>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-6 h-11">
              Excluir minha conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir sua conta ASCEND?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>Esta ação é permanente e imediata. Não guardamos backup.</p>
                  <p>
                    Digite <strong>EXCLUIR</strong> para confirmar:
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting || confirmText !== "EXCLUIR"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Excluindo…" : "Excluir permanentemente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
