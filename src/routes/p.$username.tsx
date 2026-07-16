import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getPublicProfile } from "@/lib/public-profile.functions";
import {
  NumberDisplay,
  SectionHeader,
  Eyebrow,
  Divider,
} from "@/components/ascend";
import { cn } from "@/lib/utils";

const SITE = "https://ascendatlis.lovable.app";

export const Route = createFileRoute("/p/$username")({
  loader: async ({ params }) => {
    const data = await getPublicProfile({ data: { username: params.username.toLowerCase() } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE}/p/${params.username}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Perfil não encontrado — ASCEND" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const name = loaderData.profile.display_name || loaderData.profile.username;
    const snap = loaderData.snapshot;
    const scoreText =
      snap && !snap.is_calibrating
        ? `Índice ${snap.total_score} · ${snap.matches_considered} partidas`
        : snap
          ? `Em calibração · ${snap.matches_considered}/10 partidas`
          : "Perfil no ASCEND";
    const title = `${name} — ASCEND`;
    const description = `${scoreText}. Índice de desempenho em CS2 gerado a partir das partidas na FACEIT.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PublicProfilePage,
  notFoundComponent: ProfileNotFound,
  errorComponent: ProfileError,
});

function PublicProfilePage() {
  const data = Route.useLoaderData() as NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;
  const { profile, snapshot, series, matches } = data;
  const showScore = snapshot && !snapshot.is_calibrating;
  const name = profile.display_name || profile.username;


  return (
    <PublicShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow>perfil público</Eyebrow>
          <h1
            className="mt-3 text-3xl tracking-tight text-foreground md:text-4xl"
            style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
          >
            {name}
          </h1>
          <p
            className="mt-1 text-sm text-muted-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            @{profile.username}
          </p>
        </div>
      </header>

      <div className="mt-16 flex flex-col gap-20 md:gap-24">
        <section>
          <SectionHeader number="01" title="ÍNDICE" />
          <div className="mt-6">
            {showScore ? (
              <>
                <NumberDisplay value={snapshot!.total_score} align="left" size="xl" />
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Eyebrow>de 0 a 1000</Eyebrow>
                  <span
                    className="text-xs uppercase tracking-[0.16em] text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {snapshot!.matches_considered} partidas
                  </span>
                </div>
              </>
            ) : snapshot ? (
              <EmptyBlock text={`Em calibração · faltam ${10 - snapshot.matches_considered} partidas.`} />
            ) : (
              <EmptyBlock text="Sem índice ainda." />
            )}
          </div>
        </section>

        {showScore ? (
          <section>
            <SectionHeader number="02" title="PILARES" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Pillar label="Performance" score={snapshot!.performance_score} />
              <Pillar label="Consistência" score={snapshot!.consistency_score} />
              <Pillar label="Evolução" score={snapshot!.evolution_score} />
              <Pillar label="Participação" score={snapshot!.participation_score} />
            </div>
          </section>
        ) : null}

        {series.length >= 2 ? (
          <section>
            <SectionHeader number="03" title="EVOLUÇÃO" />
            <MiniSpark
              points={series.map((s) => ({ t: new Date(s.computed_at).getTime(), v: s.total_score }))}
            />
          </section>
        ) : null}

        {matches.length > 0 ? (
          <section>
            <SectionHeader number="04" title="PARTIDAS" />
            <ul className="mt-6 flex flex-col">
              {matches.map((m) => (
                <li key={m.match_id} className="relative flex items-center gap-4 border-t border-border py-3 pl-4">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-0 top-2 bottom-2 w-0.5",
                      m.result === "win"
                        ? "bg-[color:var(--color-positive)]"
                        : m.result === "loss"
                          ? "bg-destructive"
                          : "bg-border",
                    )}
                  />
                  <span
                    className="w-20 text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {new Date(m.played_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  <span className="flex-1 text-sm text-foreground">{m.map ?? "—"}</span>
                  <span
                    className="text-sm text-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {m.rounds_won ?? "—"}:{m.rounds_lost ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <Divider className="mt-24" />
      <footer className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
        <span style={{ fontFamily: "var(--font-mono)" }}>ASCEND · público</span>
        <Link to="/" className="uppercase tracking-[0.16em] hover:text-foreground">
          criar meu perfil
        </Link>
      </footer>
    </PublicShell>
  );
}

function Pillar({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex flex-col gap-3 border border-border bg-surface p-5">
      <Eyebrow>{label}</Eyebrow>
      <div
        className="text-4xl leading-none tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
      >
        {pct}
      </div>
      <div className="h-1 w-full bg-border">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniSpark({ points }: { points: Array<{ t: number; v: number }> }) {
  if (points.length < 2) return null;
  const w = 800;
  const h = 120;
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const span = Math.max(1, max - min);
  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const tSpan = Math.max(1, tMax - tMin);
  const d = points
    .map((p, i) => {
      const x = ((p.t - tMin) / tSpan) * w;
      const y = h - ((p.v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="mt-6 w-full overflow-hidden border border-border bg-surface p-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none" aria-hidden="true">
        <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-border bg-transparent px-5 py-8 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ProfileNotFound() {
  const { username } = Route.useParams();
  return (
    <PublicShell>
      <div className="flex min-h-[60vh] flex-col justify-center">
        <Eyebrow>404</Eyebrow>
        <h1
          className="mt-4 text-4xl tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
        >
          Perfil não encontrado
        </h1>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          Nenhum perfil público em <code>/p/{username}</code>.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.16em] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            voltar para o início
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}

function ProfileError({ error }: { error: Error }) {
  return (
    <PublicShell>
      <div className="border border-destructive/40 bg-surface px-4 py-4 text-sm text-destructive">
        Não foi possível carregar este perfil: {error.message}
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link
            to="/"
            className="inline-flex items-baseline gap-2 text-foreground"
            style={{ fontFamily: "var(--font-display)", fontStretch: "125%" }}
          >
            <span className="text-lg font-semibold tracking-tight">ascend</span>
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          </Link>
          <Link
            to="/auth"
            className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            entrar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12 md:py-16">{children}</main>
    </div>
  );
}
