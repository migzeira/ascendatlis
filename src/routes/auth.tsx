import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eyebrow, Divider } from "@/components/ascend";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — ASCEND" },
      {
        name: "description",
        content: "Entre na ASCEND com Discord ou e-mail e senha.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: searchSchema,
  component: AuthPage,
});

function safeNext(next: string | undefined): string {
  if (!next) return "/onboarding";
  // só aceita caminhos internos
  if (!next.startsWith("/") || next.startsWith("//")) return "/onboarding";
  return next;
}

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const dest = safeNext(next);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Se já está logado, sai daqui.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: dest, replace: true });
    });
  }, [dest, navigate]);

  async function handleDiscord() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(dest)}`,
      },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: dest, replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: dest, replace: true });
        } else {
          setInfo("Enviamos um e-mail de confirmação. Verifique sua caixa de entrada.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-baseline gap-2 self-start text-foreground"
          style={{ fontFamily: "var(--font-display)", fontStretch: "125%" }}
        >
          <span className="text-lg font-semibold tracking-tight">ascend</span>
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
        </Link>

        <div className="mt-12">
          <Eyebrow>{mode === "signin" ? "acesso" : "criar conta"}</Eyebrow>
          <h1
            className="mt-4 text-3xl leading-[1.05] tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
          >
            {mode === "signin" ? "Entrar na ASCEND." : "Criar sua conta."}
          </h1>
        </div>

        <Button
          type="button"
          onClick={handleDiscord}
          disabled={loading}
          className="mt-10 h-11 w-full"
          variant="default"
        >
          {loading ? "Aguarde…" : "Entrar com Discord"}
        </Button>

        <div className="my-8 flex items-center gap-4">
          <Divider className="flex-1" />
          <span
            className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ou com e-mail
          </span>
          <Divider className="flex-1" />
        </div>

        <form onSubmit={handleEmail} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}

          <Button type="submit" disabled={loading} variant="outline" className="h-11">
            {loading
              ? "Aguarde…"
              : mode === "signin"
                ? "Entrar"
                : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
            setInfo(null);
          }}
          className="mt-6 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {mode === "signin" ? "Ainda não tem conta? Criar." : "Já tem conta? Entrar."}
        </button>

        <p
          className="mt-12 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Ao continuar você aceita os{" "}
          <Link to="/termos" className="underline underline-offset-4 hover:text-foreground">
            termos
          </Link>{" "}
          e a{" "}
          <Link to="/privacidade" className="underline underline-offset-4 hover:text-foreground">
            política de privacidade
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
