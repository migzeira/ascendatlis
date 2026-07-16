import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import {
  checkUsernameAvailable,
  updateMyProfile,
  getMyProfile,
  getLatestSyncJob,
} from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eyebrow } from "@/components/ascend";

const searchSchema = z.object({
  step: z.coerce.number().int().min(1).max(3).optional(),
});

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Bem-vindo — ASCEND" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: searchSchema,
  component: OnboardingPage,
});

function OnboardingPage() {
  const { step } = Route.useSearch();
  const navigate = useNavigate();
  const current = step ?? 1;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <StepIndicator current={current} />
        <div className="mt-10">
          {current === 1 ? (
            <StepUsername
              onNext={() => navigate({ to: "/onboarding", search: { step: 2 } })}
            />
          ) : null}
          {current === 2 ? (
            <StepConnect
              onNext={() => navigate({ to: "/onboarding", search: { step: 3 } })}
            />
          ) : null}
          {current === 3 ? <StepWaitSync /> : null}
        </div>
      </div>
    </main>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-3">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-1 flex-1 ${n <= current ? "bg-primary" : "bg-border"}`}
          aria-current={n === current ? "step" : undefined}
        />
      ))}
    </div>
  );
}

function StepUsername({ onNext }: { onNext: () => void }) {
  const check = useServerFn(checkUsernameAvailable);
  const update = useServerFn(updateMyProfile);
  const load = useServerFn(getMyProfile);

  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    load({}).then((p) => {
      if (p) setUsername(p.username);
    });
  }, [load]);

  useEffect(() => {
    setError(null);
    setAvailable(null);
    if (username.trim().length < 3) return;
    const t = setTimeout(async () => {
      setChecking(true);
      try {
        const r = await check({ data: { username: username.trim() } });
        setAvailable(r.available);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao verificar.");
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, check]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await update({ data: { username: username.trim() } });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Eyebrow>passo 01</Eyebrow>
      <h1
        className="mt-4 text-3xl leading-[1.05] tracking-tight md:text-4xl"
        style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
      >
        Escolha seu nome de usuário.
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Vai aparecer no seu perfil público: <code>/p/seu-username</code>.
      </p>

      <div className="mt-8">
        <Label htmlFor="username">Nome de usuário</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          className="mt-1.5"
          required
          minLength={3}
          maxLength={30}
        />
        <p
          className="mt-2 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {checking
            ? "verificando…"
            : available === true
              ? "disponível"
              : available === false
                ? "já em uso"
                : "3 a 30 caracteres; letras, números, _ . -"}
        </p>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <Button
        type="submit"
        disabled={loading || available === false || username.trim().length < 3}
        className="mt-8 h-11 w-full"
      >
        {loading ? "Salvando…" : "Continuar"}
      </Button>
    </form>
  );
}

function StepConnect({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <Eyebrow>passo 02</Eyebrow>
      <h1
        className="mt-4 text-3xl leading-[1.05] tracking-tight md:text-4xl"
        style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
      >
        Conecte sua conta FACEIT.
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        É de onde a ASCEND lê o histórico de partidas de CS2. A conexão é
        somente-leitura e você pode desfazer a qualquer momento.
      </p>

      {/* /connect ainda será implementado (Etapa 4). Usamos <a> para não travar o typecheck. */}
      <a
        href="/connect"
        className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Conectar FACEIT
      </a>

      <button
        type="button"
        onClick={onNext}
        className="mt-4 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Já conectei — avançar
      </button>
    </div>
  );
}

function StepWaitSync() {
  const load = useServerFn(getLatestSyncJob);
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [synced, setSynced] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const job = await load({});
        if (cancelled) return;
        if (!job) {
          setStatus("waiting");
          return;
        }
        setStatus(job.status);
        setSynced(job.matches_synced ?? 0);
        setErrMsg(job.error ?? null);
        if (job.status === "success") {
          // Dashboard só chega na Etapa 5; por enquanto reflete no /settings.
          setTimeout(() => {
            if (!cancelled) navigate({ to: "/settings", replace: true });
          }, 800);
        }
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "Falha ao consultar sync.");
      }
    }

    tick();
    const iv = setInterval(tick, 2000); // spec §9: polling 2s, sem Realtime
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [load, navigate]);

  return (
    <div>
      <Eyebrow>passo 03</Eyebrow>
      <h1
        className="mt-4 text-3xl leading-[1.05] tracking-tight md:text-4xl"
        style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
      >
        {status === "success"
          ? "Pronto."
          : status === "error"
            ? "Deu ruim."
            : "Sincronizando suas partidas…"}
      </h1>

      <p className="mt-3 text-sm text-muted-foreground">
        {status === "success"
          ? `Importamos ${synced} partidas. Redirecionando…`
          : status === "error"
            ? errMsg ?? "Erro desconhecido."
            : status === "waiting" || status === null
              ? "Aguardando o início da sincronização. Verifique se a FACEIT está conectada."
              : "Isso pode levar alguns segundos. Pode deixar aberto."}
      </p>

      <div className="mt-8 h-1 w-full overflow-hidden bg-border">
        <div
          className={`h-full bg-primary ${
            status === "success"
              ? "w-full"
              : status === "error"
                ? "w-1/4"
                : "w-1/2 animate-pulse"
          }`}
        />
      </div>
    </div>
  );
}
