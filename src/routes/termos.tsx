import { createFileRoute } from "@tanstack/react-router";
import { Eyebrow } from "@/components/ascend";
import { AppShell } from "@/components/ascend/AppShell";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos — ASCEND" },
      {
        name: "description",
        content: "Termos de uso da ASCEND.",
      },
      { property: "og:title", content: "Termos — ASCEND" },
      { property: "og:description", content: "Termos de uso da ASCEND." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <AppShell>
      <article className="max-w-2xl">
        <Eyebrow>documento legal</Eyebrow>
        <h1
          className="mt-4 text-3xl leading-[1.05] tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
        >
          Termos.
        </h1>

        <div className="prose prose-invert mt-10 max-w-none text-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-4 [&_p]:text-muted-foreground [&_p]:leading-relaxed">
          <p>
            Ao usar a ASCEND você concorda com estes termos. Se não concordar,
            não use.
          </p>

          <h2>Do que se trata</h2>
          <p>
            A ASCEND lê dados públicos das suas partidas de CS2 na FACEIT e
            calcula um índice de desempenho de 0 a 1000. Não somos parceiros
            oficiais da FACEIT nem da Valve.
          </p>

          <h2>Sua conta</h2>
          <p>
            Você é responsável pelo seu login (Discord ou e-mail e senha).
            Compartilhamento de conta pode resultar em suspensão. Uma conta por
            pessoa.
          </p>

          <h2>Como usar</h2>
          <p>
            Não tente burlar o motor, injetar dados falsos ou fazer scraping
            automatizado das páginas. O motor é determinístico: dados reais
            entram, número real sai.
          </p>

          <h2>Sem garantia</h2>
          <p>
            O Ascend Index é uma leitura estatística das suas partidas. Não é
            um veredito sobre você como pessoa nem um filtro de contratação.
            Não nos responsabilizamos por decisões tomadas com base no índice.
          </p>

          <h2>Alterações</h2>
          <p>
            Podemos ajustar estes termos conforme o produto evolui. Mudanças
            relevantes serão comunicadas na aplicação.
          </p>
        </div>
      </article>
    </AppShell>
  );
}
