import { createFileRoute, Link } from "@tanstack/react-router";
import { NumberDisplay, Eyebrow, Divider } from "@/components/ascend";

const SITE = "https://ascendatlis.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ASCEND — o índice do seu CS2" },
      {
        name: "description",
        content:
          "Um índice único de 0 a 1000 que traduz sua evolução no Counter-Strike 2. Conecte sua conta FACEIT e acompanhe performance, consistência, evolução e ritmo — sem achismo.",
      },
      { property: "og:title", content: "ASCEND — o índice do seu CS2" },
      {
        property: "og:description",
        content:
          "Um índice único de 0 a 1000 que traduz sua evolução no Counter-Strike 2.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE + "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ASCEND — o índice do seu CS2" },
      {
        name: "twitter:description",
        content:
          "Um índice único de 0 a 1000 que traduz sua evolução no Counter-Strike 2.",
      },
    ],
    links: [{ rel: "canonical", href: SITE + "/" }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-10">
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

      <main className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-24">
        {/* HERO — assimétrico. H1 à esquerda, número gigante à direita como arte tipográfica. */}
        <section className="grid grid-cols-1 items-start gap-12 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7">
            <h1
              className="text-4xl leading-[1.02] tracking-tight text-foreground md:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
            >
              O seu CS2,<br />medido em<br />um número só.
            </h1>
            <p className="mt-8 max-w-lg text-base text-muted-foreground md:text-lg">
              A ASCEND lê suas partidas na FACEIT e devolve um índice de 0 a 1000
              que evolui com você — performance, consistência, evolução e ritmo,
              sem achismo.
            </p>
            <div className="mt-10">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center bg-primary px-6 py-3 text-sm uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-[color:var(--color-accent-hover)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                entrar com discord
              </Link>
            </div>
          </div>

          <div className="md:col-span-5 md:pt-8">
            <NumberDisplay value="742" align="right" />
            <div className="mt-2 text-right">
              <Eyebrow>arte tipográfica · não é seu score</Eyebrow>
            </div>
          </div>
        </section>

        <Divider className="my-20 md:my-28" />

        {/* 3 PASSOS, eyebrows numerados. */}
        <section>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            <Step number="01" title="Entre com Discord">
              Login é identidade. Um clique, sem senha nova.
            </Step>
            <Step number="02" title="Conecte a FACEIT">
              Autorize a leitura das suas partidas de CS2. Só leitura, nada é postado.
            </Step>
            <Step number="03" title="Acompanhe seu índice">
              Evolução, pilares e leituras determinísticas — atualizado a cada sync.
            </Step>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:px-10">
          <span style={{ fontFamily: "var(--font-mono)" }}>© ASCEND</span>
          <div className="flex gap-6">
            <Link
              to="/privacidade"
              className="uppercase tracking-[0.16em] hover:text-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              privacidade
            </Link>
            <Link
              to="/termos"
              className="uppercase tracking-[0.16em] hover:text-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              termos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Eyebrow>{number}</Eyebrow>
      <div
        className="text-2xl leading-tight text-foreground"
        style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
      >
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
