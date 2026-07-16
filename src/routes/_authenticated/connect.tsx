import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  disconnectFaceit,
  getFaceitConnection,
  startFaceitOAuth,
  triggerFaceitSync,
} from "@/lib/faceit.functions";
import { getLatestSyncJob } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/ascend/AppShell";
import { Eyebrow, SectionHeader } from "@/components/ascend";

const searchSchema = z.object({
  ok: z.string().optional(),
  error: z.string().optional(),
});

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Sessão de conexão expirou. Tente de novo.",
  token_exchange: "A FACEIT recusou a troca do código. Tente de novo.",
  no_guid: "A FACEIT não retornou o identificador da conta.",
  already_linked: "Esta conta FACEIT já está vinculada a outro usuário.",
  account_upsert: "Falha ao registrar a conta.",
  secret_store: "Falha ao guardar os tokens de forma segura.",
  missing_params: "A resposta da FACEIT chegou incompleta.",
};

export const Route = createFileRoute("/_authenticated/connect")({
  head: () => ({
    meta: [
      { title: "Conexões — ASCEND" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: searchSchema,
  component: ConnectPage,
});

function ConnectPage() {
  const { ok, error } = Route.useSearch();

  return (
    <AppShell>
      <SectionHeader number="01" title="CONEXÕES" />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Conecte suas contas de jogo. A ASCEND só lê estatísticas — não joga por
        você, não posta nada, não muda nada na plataforma de origem.
      </p>

      {ok ? (
        <div className="mt-6 border border-border bg-surface px-4 py-3 text-sm text-foreground">
          Conta FACEIT conectada com sucesso.
        </div>
      ) : null}
      {error ? (
        <div className="mt-6 border border-destructive/40 bg-surface px-4 py-3 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? `Erro: ${error}`}
        </div>
      ) : null}

      <div className="mt-10 grid gap-4">
        <FaceitCard />
        <SoonCard title="Steam" />
        <SoonCard title="Riot Games" />
      </div>
    </AppShell>
  );
}

function FaceitCard() {
  const load = useServerFn(getFaceitConnection);
  const loadJob = useServerFn(getLatestSyncJob);
  const start = useServerFn(startFaceitOAuth);
  const sync = useServerFn(triggerFaceitSync);
  const disconnect = useServerFn(disconnectFaceit);

  const [connection, setConnection] = useState<
    Awaited<ReturnType<typeof getFaceitConnection>> | null
  >(null);
  const [job, setJob] = useState<Awaited<ReturnType<typeof getLatestSyncJob>> | null>(
    null,
  );
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const [c, j] = await Promise.all([load({}), loadJob({})]);
    setConnection(c);
    setJob(j);
  }

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeJob = job?.status === "pending" || job?.status === "running";

  async function handleConnect() {
    setErr(null);
    setBusy("connect");
    try {
      const { authorize_url } = await start({});
      window.location.href = authorize_url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao iniciar OAuth.");
      setBusy(null);
    }
  }

  async function handleSync() {
    setErr(null);
    setBusy("sync");
    try {
      await sync({});
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao sincronizar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar a FACEIT? Suas partidas ficam salvas.")) return;
    setErr(null);
    setBusy("disconnect");
    try {
      await disconnect({});
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao desconectar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border border-border bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>provider</Eyebrow>
          <h2
            className="mt-2 text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
          >
            FACEIT
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Fonte oficial das partidas de CS2.
          </p>
        </div>
        <StatusBadge connection={connection} activeJob={activeJob} />
      </div>

      {connection ? (
        <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt
              className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              nickname
            </dt>
            <dd className="mt-1 text-foreground">{connection.nickname ?? "—"}</dd>
          </div>
          <div>
            <dt
              className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              última sync
            </dt>
            <dd className="mt-1 text-foreground">
              {connection.last_synced_at
                ? new Date(connection.last_synced_at).toLocaleString("pt-BR")
                : "nunca"}
            </dd>
          </div>
          {job ? (
            <div className="md:col-span-2">
              <dt
                className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                job atual
              </dt>
              <dd className="mt-1 text-foreground">
                {job.status}
                {job.matches_synced ? ` · ${job.matches_synced} partidas` : ""}
                {job.error ? ` · ${job.error}` : ""}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {err ? <p className="mt-4 text-sm text-destructive">{err}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {connection ? (
          <>
            <Button onClick={handleSync} disabled={busy !== null || activeJob}>
              {busy === "sync" || activeJob ? "Sincronizando…" : "Sincronizar agora"}
            </Button>
            <Button
              variant="outline"
              onClick={handleConnect}
              disabled={busy !== null}
            >
              Reconectar
            </Button>
            <Button
              variant="ghost"
              onClick={handleDisconnect}
              disabled={busy !== null}
            >
              Desconectar
            </Button>
          </>
        ) : (
          <Button onClick={handleConnect} disabled={busy !== null}>
            {busy === "connect" ? "Redirecionando…" : "Conectar FACEIT"}
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  connection,
  activeJob,
}: {
  connection: { needs_reauth: boolean } | null;
  activeJob: boolean;
}) {
  let label = "desconectado";
  let tone = "text-muted-foreground";
  if (connection) {
    if (connection.needs_reauth) {
      label = "reconectar";
      tone = "text-destructive";
    } else if (activeJob) {
      label = "sincronizando";
      tone = "text-primary";
    } else {
      label = "conectado";
      tone = "text-foreground";
    }
  }
  return (
    <span
      className={`text-[0.7rem] uppercase tracking-[0.14em] ${tone}`}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {label}
    </span>
  );
}

function SoonCard({ title }: { title: string }) {
  return (
    <div className="border border-dashed border-border bg-transparent p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Eyebrow>provider</Eyebrow>
          <h2
            className="mt-2 text-2xl tracking-tight text-muted-foreground"
            style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
          >
            {title}
          </h2>
        </div>
        <span
          className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          em integração
        </span>
      </div>
    </div>
  );
}
