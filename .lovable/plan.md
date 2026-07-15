
# Etapa 1 — Gravar AGENTS.md canônico

Nenhum código, nenhuma migration, nenhuma UI. Só escrita de arquivo.

## Ação única

Reescrever `AGENTS.md` na raiz com esta estrutura:

1. **Preservar intacto** o bloco `<!-- LOVABLE:BEGIN -->` … `<!-- LOVABLE:END -->` (leio o atual antes de sobrescrever e copio verbatim).
2. Abaixo dele, gravar a especificação completa Ascend na íntegra, com estas seções (nomes literais, nesta ordem):
   - **PRINCÍPIOS**
   - **MODELO DE DADOS** — DDL SQL completo de: `profiles`, `connected_accounts`, `connected_account_secrets`, `oauth_states`, `sync_jobs` (com índice único parcial), `matches` (com todas as colunas: `played_at`, `game`, `map`, `rounds_won`, `rounds_lost`, `duration_seconds`, `result` `win|loss|draw`, `raw jsonb NOT NULL`, **UNIQUE (user_id, provider, match_id)**), `match_stats` (**PK = match_id**, com `adr`, `kr_ratio`, `headshots`, `rating_approx`, `headshot_pct` 0–100, `user_id` denormalizado NOT NULL), `index_snapshots` (com `is_calibrating`, `breakdown jsonb`, **sem UNIQUE** — dedupe em código).
   - **RLS** — `alter table ... enable rls`, `revoke`/`grant` explícitos, policies textuais. Fórmula pública canônica: `using (user_id = (select auth.uid()) or public.is_profile_public(user_id))` em `matches`, `match_stats`, `index_snapshots` (to anon, authenticated). `connected_account_secrets` com zero policies e revoke total de anon+authenticated. Helper:
     ```sql
     create or replace function public.is_profile_public(p_id uuid)
     returns boolean language sql stable security definer set search_path = public
     as $$ select coalesce((select is_public from public.profiles where id = p_id), false) $$;
     revoke execute on function public.is_profile_public(uuid) from public;
     grant execute on function public.is_profile_public(uuid) to anon, authenticated;
     ```
   - **AUTENTICAÇÃO** — Discord OAuth como login; FACEIT é connect. Trigger `handle_new_user`. Gate `_authenticated/`.
   - **EDGE FUNCTIONS** — contrato de cada uma (`faceit-oauth-start`, `faceit-oauth-callback`, `faceit-sync`, `faceit-sync-all`, `compute-index`, `delete-account`): método, `verify_jwt`, entradas/saídas, códigos de erro. Fluxo OAuth FACEIT não-padrão (authorize em `accounts.faceit.com/` sem `redirect_uri`/`scope`, token com `Authorization: Basic`, userinfo com `guid`). Criptografia AES-GCM Web Crypto com `TOKEN_ENC_KEY`. `faceit-sync` usa **apenas `FACEIT_API_KEY` server-side na Data API v4** (não descriptografa tokens, não seta `needs_reauth` por refresh). Backoff 2s/4s/8s, máx 3 tentativas. `faceit-sync-all` com `verify_jwt=true` + service_role via Vault. SQL do `pg_cron`/`pg_net`/Vault a cada 6h.
   - **ASCEND INDEX v1 — FÓRMULA EXATA** — pseudocódigo TypeScript completo com **todos os pesos e limiares literais**: `performance_score` (com `rating_approx` derivado de `adr` + `kr_ratio` a 70%), `consistency_score`, `evolution_score` (regressão linear ordenada por `played_at` ASC), `participation_score`, agregação final ponderada, `is_calibrating` quando `matches_considered < 10`. Regra do dedupe em código (comparar `matches_considered` + 4 pilares arredondados a 4 casas com o último snapshot).
   - **TABELA DE MAPEAMENTO FACEIT → SCHEMA** — chaves literais da Data API v4:
     `K/D Ratio` → `kd_ratio`, `K/R Ratio` → `kr_ratio`, `ADR` → `adr`, `Headshots %` → `headshot_pct` (0–100), `Headshots` → `headshots`, `Kills`/`Deaths`/`Assists`/`MVPs`/`Rounds` → homônimos, `Result` → 1/0 → `won`/`result`. Todas as stats chegam como string → parse.
   - **INSIGHTS DETERMINÍSTICOS** — regras textuais (sem LLM), persistidos em `index_snapshots.breakdown.insights`.
   - **TELAS** — `/`, `/auth`, `/onboarding`, `/connect`, `/dashboard` (6 seções na ordem exata), `/settings`, `/p/:username`, `/privacidade`, `/termos`. Descrição de cada estado (vazio, calibração, erro, loading). Regras dos 4 screenshot-checks do dashboard.
   - **ROTEAMENTO E GUARDAS** — `_authenticated/` gate managed; rotas públicas com SSR e OG por rota; `/p/:username` privado/inexistente → 404 real.
   - **COMPONENTES DE ASSINATURA** — `NumberDisplay`, `SectionHeader`, `Eyebrow`, `Divider`, `MonoLabel`, `LockedCard` (dashed, transparente). Shell: sidebar desktop / header+drawer mobile. Tokens de tipografia (Archivo wdth 125%, Schibsted Grotesk, Spline Sans Mono).
   - **DESIGN TOKENS** — paleta oklch, `--font-display/--font-sans/--font-mono`, regras de uso (número do Index branco/esquerda/fora de card; laranja é acento; zero cores hard-coded).
   - **DEFINITION OF DONE** — checklist completo (sem fake data; sem rotas proibidas; sem `VITE_FACEIT_*`; tokens isolados; policies públicas via helper; mobile 360px sem scroll horizontal; OG por rota; motor determinístico; cron a cada 6h; etc).

Íntegra = íntegra: SQL DDL completo, pseudocódigo do motor com constantes, tabela de mapeamento. Sem "veja acima", sem elipses. Arquivo deve se sustentar sem este chat.

## Ao terminar

Reporto o tamanho final do arquivo em bytes.

Aprova?
