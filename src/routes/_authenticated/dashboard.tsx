import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/ascend/AppShell";
import {
  SectionHeader,
  NumberDisplay,
  Eyebrow,
  Divider,
  LockedCard,
} from "@/components/ascend";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/dashboard.functions";
import { triggerFaceitSync } from "@/lib/faceit.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ASCEND" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

type DashData = Awaited<ReturnType<typeof getDashboardData>>;

function DashboardPage() {
  const load = useServerFn(getDashboardData);
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => load({}),
    refetchInterval: (q) => {
      const d = q.state.data as DashData | undefined;
      const s = d?.job?.status;
      return s === "pending" || s === "running" ? 3000 : false;
    },
  });

  return (
    <AppShell>
      {query.isLoading ? (
        <DashboardSkeleton />
      ) : query.data ? (
        <DashboardBody data={query.data} />
      ) : (
        <ErrorState message={query.error instanceof Error ? query.error.message : "Falha ao carregar."} />
      )}
    </AppShell>
  );
}

function DashboardBody({ data }: { data: DashData }) {
  const { connection, snapshot, series, matches, stats, job, delta7d } = data;

  if (!connection) return <EmptyState />;

  const insights = extractInsights(snapshot?.breakdown);
  const calibrating = snapshot?.is_calibrating ?? true;
  const showScore = snapshot && !calibrating;

  return (
    <div className="flex flex-col gap-20 md:gap-24">
      {/* 01 / ÍNDICE — número fora de card, esquerda, foreground */}
      <section>
        <SectionHeader number="01" title="ÍNDICE" />
        <div className="mt-6">
          {showScore ? (
            <>
              <NumberDisplay value={snapshot!.total_score} align="left" size="xl" />
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Eyebrow>de 0 a 1000</Eyebrow>
                {delta7d !== null ? <DeltaBadge delta={delta7d} /> : null}
                <span
                  className="text-xs uppercase tracking-[0.16em] text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {snapshot!.matches_considered} partidas
                </span>
              </div>
            </>
          ) : snapshot ? (
            <CalibratingState considered={snapshot.matches_considered} />
          ) : (
            <NoSnapshotState hasJob={!!job} />
          )}
        </div>
      </section>

      {/* 02 / EVOLUÇÃO */}
      <section>
        <SectionHeader number="02" title="EVOLUÇÃO" />
        <div className="mt-6">
          {series.length >= 2 ? (
            <EvolutionChart series={series} />
          ) : (
            <EmptyBlock text="Sem histórico suficiente. O gráfico aparece após 2 snapshots pós-calibração." />
          )}
        </div>
      </section>

      {/* 03 / PILARES */}
      <section>
        <SectionHeader number="03" title="PILARES" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PillarCard
            label="Performance"
            score={showScore ? snapshot!.performance_score : null}
            weight={40}
          />
          <PillarCard
            label="Consistência"
            score={showScore ? snapshot!.consistency_score : null}
            weight={25}
          />
          <PillarCard
            label="Evolução"
            score={showScore ? snapshot!.evolution_score : null}
            weight={20}
          />
          <PillarCard
            label="Participação"
            score={showScore ? snapshot!.participation_score : null}
            weight={15}
          />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LockedCard title="Comunicação" source="Peer review do time" />
          <LockedCard title="Trabalho em equipe" source="Peer review do time" />
          <LockedCard title="Liderança" source="Avaliação de treinador" />
          <LockedCard title="Disciplina" source="Check-in de rotina e treinos" />
          <LockedCard title="Fair Play" source="Reports das plataformas" />
          <LockedCard title="Conteúdo" source="Integração Twitch / YouTube" />
          <LockedCard title="Marca pessoal" source="ASCEND Studio" />
        </div>
      </section>

      {/* 04 / LEITURA */}
      <section>
        <SectionHeader number="04" title="LEITURA" />
        <div className="mt-6">
          {insights.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {insights.map((line, i) => (
                <li
                  key={i}
                  className="border-l-2 border-primary pl-4 text-base text-foreground"
                >
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock text="A leitura aparece quando você tiver ao menos 10 partidas consideradas." />
          )}
        </div>
      </section>

      {/* 05 / PARTIDAS — tabular, barra 2px */}
      <section>
        <SectionHeader number="05" title="PARTIDAS" />
        <div className="mt-6">
          {matches.length > 0 ? (
            <MatchesTable matches={matches} stats={stats} />
          ) : (
            <EmptyBlock text="Nenhuma partida sincronizada ainda." />
          )}
        </div>
      </section>

      {/* 06 / SINCRONIZAÇÃO */}
      <section>
        <SectionHeader number="06" title="SINCRONIZAÇÃO" />
        <SyncBlock job={job} lastSyncedAt={connection.last_synced_at} />
      </section>
    </div>
  );
}

/* ============================================================ */
/*  Sub-components                                              */
/* ============================================================ */

function DeltaBadge({ delta }: { delta: number }) {
  const rounded = Math.round(delta);
  if (rounded === 0) {
    return (
      <span
        className="text-xs uppercase tracking-[0.16em] text-muted-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        7d · estável
      </span>
    );
  }
  const positive = rounded > 0;
  return (
    <span
      className={cn(
        "text-xs uppercase tracking-[0.16em]",
        positive ? "text-[color:var(--color-positive)]" : "text-destructive",
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      7d · {positive ? "+" : ""}
      {rounded}
    </span>
  );
}

function CalibratingState({ considered }: { considered: number }) {
  const done = Math.max(0, Math.min(10, considered));
  const missing = 10 - done;
  return (
    <div>
      <div
        className="text-3xl tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
      >
        Calibrando
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Faltam {missing} {missing === 1 ? "partida" : "partidas"} pra liberar seu índice.
      </p>
      <div
        className="mt-6 flex gap-1.5"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={10}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 flex-1 border border-border",
              i < done ? "bg-primary" : "bg-transparent",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function NoSnapshotState({ hasJob }: { hasJob: boolean }) {
  return (
    <div>
      <div
        className="text-3xl tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
      >
        {hasJob ? "Aguardando primeiro cálculo" : "Sem dados ainda"}
      </div>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {hasJob
          ? "O primeiro sync está em andamento. Assim que houver partidas suficientes, seu índice aparece aqui."
          : "Rode uma sincronização em Conexões para importar suas partidas de CS2."}
      </p>
    </div>
  );
}

function EvolutionChart({
  series,
}: {
  series: Array<{ total_score: number; computed_at: string; is_calibrating: boolean }>;
}) {
  const data = useMemo(
    () =>
      series.map((p) => ({
        t: new Date(p.computed_at).getTime(),
        score: p.total_score,
      })),
    [series],
  );
  const fmt = (t: number) =>
    new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ascendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmt}
            stroke="var(--color-muted-foreground)"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={{ stroke: "var(--color-border)" }}
          />
          <YAxis
            domain={[0, 1000]}
            stroke="var(--color-muted-foreground)"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={{ stroke: "var(--color-border)" }}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
              fontSize: 12,
            }}
            labelFormatter={(v) => fmt(Number(v))}
            formatter={(v: number) => [v, "Índice"]}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#ascendFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PillarCard({
  label,
  score,
  weight,
}: {
  label: string;
  score: number | null;
  weight: number;
}) {
  const pct = score !== null ? Math.round(score * 100) : null;
  return (
    <div className="flex flex-col gap-3 border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <Eyebrow>{label}</Eyebrow>
        <span
          className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          peso {weight}%
        </span>
      </div>
      <div
        className="text-4xl leading-none tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
      >
        {pct !== null ? pct : "—"}
      </div>
      <div className="h-1 w-full bg-border">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function MatchesTable({
  matches,
  stats,
}: {
  matches: DashData["matches"];
  stats: DashData["stats"];
}) {
  const byId = useMemo(() => {
    const m = new Map<string, DashData["stats"][number]>();
    for (const s of stats) m.set(s.match_id, s);
    return m;
  }, [stats]);

  return (
    <div className="-mx-6 overflow-x-auto md:mx-0">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr
            className="text-left text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <th className="px-6 py-3 md:pl-4">data</th>
            <th className="px-3 py-3">mapa</th>
            <th className="px-3 py-3 text-right">placar</th>
            <th className="px-3 py-3 text-right">k/d/a</th>
            <th className="px-3 py-3 text-right">adr</th>
            <th className="px-3 py-3 text-right">hs%</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const s = byId.get(m.match_id);
            const won = m.result === "win";
            return (
              <tr key={m.match_id} className="border-t border-border">
                <td className="relative px-6 py-3 md:pl-4">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-0 top-2 bottom-2 w-0.5",
                      won
                        ? "bg-[color:var(--color-positive)]"
                        : m.result === "loss"
                          ? "bg-destructive"
                          : "bg-border",
                    )}
                  />
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {new Date(m.played_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </td>
                <td className="px-3 py-3 text-foreground">{m.map ?? "—"}</td>
                <td
                  className="px-3 py-3 text-right text-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {m.rounds_won ?? "—"}:{m.rounds_lost ?? "—"}
                </td>
                <td
                  className="px-3 py-3 text-right text-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {s ? `${s.kills}/${s.deaths}/${s.assists}` : "—"}
                </td>
                <td
                  className="px-3 py-3 text-right text-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {s ? s.adr.toFixed(0) : "—"}
                </td>
                <td
                  className="px-3 py-3 text-right text-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {s ? `${s.headshot_pct.toFixed(0)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SyncBlock({
  job,
  lastSyncedAt,
}: {
  job: DashData["job"];
  lastSyncedAt: string | null;
}) {
  const qc = useQueryClient();
  const sync = useServerFn(triggerFaceitSync);
  const mutation = useMutation({
    mutationFn: () => sync({}),
    onSettled: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const active = job?.status === "pending" || job?.status === "running";
  const isError = job?.status === "error";

  return (
    <div className="mt-6 flex flex-col gap-6">
      {isError ? (
        <div className="border border-destructive/40 bg-surface px-4 py-3 text-sm text-destructive">
          Última sincronização falhou{job?.error ? `: ${job.error}` : "."}
        </div>
      ) : null}

      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <StatCell label="última sync" value={lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("pt-BR") : "nunca"} />
        <StatCell label="status" value={job?.status ?? "—"} />
        <StatCell
          label="partidas no último job"
          value={job?.matches_synced != null ? String(job.matches_synced) : "—"}
        />
      </dl>

      <Divider />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => mutation.mutate()}
          disabled={active || mutation.isPending}
        >
          {active || mutation.isPending ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
        <Link
          to="/connect"
          className="text-xs uppercase tracking-[0.16em] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          gerenciar conexões
        </Link>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd
        className="mt-1 text-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </dd>
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

function EmptyState() {
  return (
    <div className="flex flex-col gap-8">
      <SectionHeader number="01" title="ÍNDICE" />
      <div>
        <div
          className="text-4xl tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
        >
          Conecte sua FACEIT
        </div>
        <p className="mt-4 max-w-lg text-base text-muted-foreground">
          Seu índice, evolução e leitura começam depois do primeiro sync.
          Nada é calculado com dado simulado.
        </p>
        <div className="mt-8">
          <Button asChild>
            <Link to="/connect">Ir para Conexões</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-destructive/40 bg-surface px-4 py-4 text-sm text-destructive">
      Não foi possível carregar o dashboard: {message}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-20 md:gap-24" aria-busy="true">
      <section>
        <SkeletonLine w="w-24" />
        <div className="mt-6 h-40 w-full max-w-[520px] animate-pulse bg-surface" />
      </section>
      <section>
        <SkeletonLine w="w-32" />
        <div className="mt-6 h-64 w-full animate-pulse bg-surface" />
      </section>
      <section>
        <SkeletonLine w="w-24" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse border border-border bg-surface" />
          ))}
        </div>
      </section>
      <section>
        <SkeletonLine w="w-28" />
        <div className="mt-6 h-40 w-full animate-pulse bg-surface" />
      </section>
    </div>
  );
}

function SkeletonLine({ w }: { w: string }) {
  return <div className={cn("h-3 animate-pulse bg-surface", w)} />;
}

/* ============================================================ */
/*  helpers                                                     */
/* ============================================================ */

function extractInsights(breakdown: unknown): string[] {
  if (!breakdown || typeof breakdown !== "object") return [];
  const b = breakdown as { insights?: unknown };
  if (!Array.isArray(b.insights)) return [];
  return b.insights.filter((x): x is string => typeof x === "string" && x.length > 0);
}
