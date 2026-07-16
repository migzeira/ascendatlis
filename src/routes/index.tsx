import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ascend/AppShell";
import {
  NumberDisplay,
  SectionHeader,
  Eyebrow,
  Divider,
  LockedCard,
} from "@/components/ascend";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ASCEND — o índice do seu CS2" },
      {
        name: "description",
        content:
          "Conecte sua conta FACEIT e transforme suas partidas de CS2 em um índice único de 0 a 1000.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <AppShell>
      <section className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-7">
          <Eyebrow>01 / índice de desempenho</Eyebrow>
          <h1
            className="mt-6 text-4xl leading-[1.05] tracking-tight text-foreground md:text-6xl"
            style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
          >
            O seu CS2, medido em<br />um número só.
          </h1>
          <p className="mt-6 max-w-lg text-base text-muted-foreground md:text-lg">
            Conecte a FACEIT. A ASCEND lê suas partidas, calcula performance, consistência,
            evolução e ritmo — e devolve um índice de 0 a 1000 que evolui com você.
          </p>
        </div>

        <div className="md:col-span-5 md:pt-12">
          <NumberDisplay value="742" align="right" />
          <div className="mt-2 text-right">
            <Eyebrow>arte tipográfica · não é seu score</Eyebrow>
          </div>
        </div>
      </section>

      <Divider className="my-16" />

      <section className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <Step number="01" title="Entre com Discord">
          Login é identidade. Um clique, sem senha nova.
        </Step>
        <Step number="02" title="Conecte a FACEIT">
          Autorize a leitura das suas partidas de CS2. Só leitura.
        </Step>
        <Step number="03" title="Acompanhe seu índice">
          Evolução, pilares e leituras determinísticas — sem achismo.
        </Step>
      </section>

      <Divider className="my-16" />

      <section>
        <SectionHeader number="03" title="pilares em breve" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LockedCard title="Comunicação" source="Peer review do time" />
          <LockedCard title="Trabalho em equipe" source="Peer review do time" />
          <LockedCard title="Liderança" source="Avaliação de treinador" />
          <LockedCard title="Disciplina" source="Check-in de rotina e treinos" />
          <LockedCard title="Fair Play" source="Reports e punições das plataformas" />
          <LockedCard title="Conteúdo" source="Integração Twitch / YouTube" />
        </div>
      </section>
    </AppShell>
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
    <div className="flex flex-col gap-3">
      <Eyebrow>{number}</Eyebrow>
      <div
        className="text-xl text-foreground"
        style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
      >
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
