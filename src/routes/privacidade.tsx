import { createFileRoute } from "@tanstack/react-router";
import { Eyebrow } from "@/components/ascend";
import { AppShell } from "@/components/ascend/AppShell";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade — ASCEND" },
      {
        name: "description",
        content: "Política de privacidade da ASCEND: quais dados são coletados, como são usados e como excluir a conta.",
      },
      { property: "og:title", content: "Privacidade — ASCEND" },
      { property: "og:description", content: "Política de privacidade da ASCEND." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <AppShell>
      <article className="max-w-2xl">
        <Eyebrow>documento legal</Eyebrow>
        <h1
          className="mt-4 text-3xl leading-[1.05] tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-display)", fontStretch: "125%", fontWeight: 600 }}
        >
          Privacidade.
        </h1>

        <div className="prose prose-invert mt-10 max-w-none text-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-4 [&_p]:text-muted-foreground [&_p]:leading-relaxed">
          <p>
            A ASCEND transforma dados públicos de partidas de CS2 em um índice de
            desempenho. Esta página explica o que coletamos, por quê e como você
            controla seus dados.
          </p>

          <h2>Dados que coletamos</h2>
          <p>
            <strong>Identidade:</strong> ao entrar com Discord, recebemos seu ID,
            nome de usuário e avatar. Ao entrar por e-mail, guardamos seu e-mail
            e uma senha com hash. Nada além disso.
          </p>
          <p>
            <strong>FACEIT:</strong> quando você conecta sua conta FACEIT, salvamos
            o histórico público de partidas de CS2 e as estatísticas de cada
            partida. Os tokens de acesso ficam criptografados no servidor e
            nunca são expostos ao navegador.
          </p>

          <h2>O que fazemos com esses dados</h2>
          <p>
            Calculamos seu Ascend Index a partir das suas partidas. O cálculo é
            determinístico e roda no nosso servidor. Nada é vendido, nada é
            compartilhado com terceiros para publicidade.
          </p>

          <h2>Perfil público</h2>
          <p>
            Se você deixar seu perfil como público, sua página <code>/p/seu-username</code>
            fica visível para qualquer pessoa com o link. Você pode alternar isso
            a qualquer momento em Ajustes.
          </p>

          <h2>Exclusão de conta</h2>
          <p>
            Em Ajustes há um botão de excluir conta. Ele remove sua identidade,
            perfil, tokens da FACEIT, histórico de partidas e snapshots do índice
            de forma permanente. Não guardamos backup dos seus dados após a
            exclusão.
          </p>

          <h2>Contato</h2>
          <p>
            Dúvidas sobre privacidade: escreva pelo Discord da comunidade ASCEND.
          </p>
        </div>
      </article>
    </AppShell>
  );
}
