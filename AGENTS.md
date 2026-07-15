<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# ASCEND — Especificação canônica

Este arquivo é a fonte da verdade. Onde algo aqui diverge do que estiver em
prompt, chat, memória ou README, este arquivo vence. Ele se sustenta sozinho:
sem `veja acima`, sem elipses, sem `resumo`.

Ascend transforma dados brutos de partidas de CS2 (via FACEIT) em um índice
único de 0 a 100, com evolução ao longo do tempo, pilares e leituras
determinísticas. Login é Discord (identidade). FACEIT é conexão de conta de
jogo (dado). São coisas separadas e não podem ser misturadas.

---

## 1. PRINCÍPIOS

1. **Zero dado fake.** Nada de seed, sample, placeholder, mock, `dummyUser`,
   `fakeMatch`. Nem em migration, nem em dev, nem em storybook, nem em
   snapshot de teste. Se não há dado real, a tela renderiza o estado vazio
   especificado.
2. **Zero rota fora do escopo.** Não existe Arena, Academy, Studio, Partners,
   Store, Wallet, Careers, Teams, Matchmaking. Nem no menu, nem em
   placeholder, nem em `TODO`. As únicas rotas são as listadas em §9.
3. **Zero segredo no frontend.** Nenhum `VITE_FACEIT_*`. Client IDs, secrets
   e chaves de API são secrets do backend (edge functions), acessados via
   `Deno.env.get(...)` ou `process.env.*` server-side.
4. **Zero dado inventado no motor.** A fórmula do Ascend Index é
   determinística e literal (§6). Não há LLM, não há aproximação implícita,
   não há `Math.random`. Reprocessar o mesmo `matches` + `match_stats`
   sempre produz o mesmo `index_snapshot`.
5. **Zero acoplamento entre login e provider.** Discord = identidade.
   FACEIT = provider de dados. Um user pode existir sem FACEIT conectado.
6. **Segurança por isolamento.** Tokens OAuth do usuário ficam em tabela
   separada, criptografados, sem policy nenhuma. Só `service_role` toca.
7. **RLS é por linha, não por coluna.** Qualquer campo sensível vive em
   tabela separada quando a linha precisa ser lida por outra audiência.
8. **Motor server-side, sempre.** Frontend nunca calcula Index nem insight.
   Lê snapshot pronto.

---

## 2. MODELO DE DADOS

DDL completo. Todo `CREATE TABLE public.*` é seguido de `GRANT` explícito
antes do `ENABLE ROW LEVEL SECURITY`. Nomes das tabelas são canônicos e não
podem ser renomeados.

```sql
-- =========================================================================
-- profiles
-- =========================================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique,
  display_name  text,
  avatar_url    text,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant select                          on public.profiles to anon;
grant all                             on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles: owner reads own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: public reads is_public"
  on public.profiles for select to anon, authenticated
  using (is_public = true);

create policy "profiles: owner updates own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: owner inserts own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

-- Trigger de criação em signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      'user_' || substr(new.id::text, 1, 8)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- connected_accounts  (metadados; visível ao dono)
-- =========================================================================
create table public.connected_accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  provider           text not null check (provider in ('faceit')),
  provider_user_id   text not null,
  nickname           text,
  connected_at       timestamptz not null default now(),
  last_synced_at     timestamptz,
  needs_reauth       boolean not null default false,
  unique (provider, provider_user_id)
);

grant select, delete on public.connected_accounts to authenticated;
grant all           on public.connected_accounts to service_role;

alter table public.connected_accounts enable row level security;

create policy "connected_accounts: owner reads own"
  on public.connected_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create policy "connected_accounts: owner deletes own"
  on public.connected_accounts for delete to authenticated
  using (user_id = (select auth.uid()));

-- =========================================================================
-- connected_account_secrets  (tokens criptografados; ZERO policies)
-- =========================================================================
create table public.connected_account_secrets (
  account_id                uuid primary key references public.connected_accounts(id) on delete cascade,
  access_token_ct           bytea not null,
  access_token_iv           bytea not null,
  refresh_token_ct          bytea,
  refresh_token_iv          bytea,
  access_token_expires_at   timestamptz,
  updated_at                timestamptz not null default now()
);

revoke all on public.connected_account_secrets from public;
revoke all on public.connected_account_secrets from anon;
revoke all on public.connected_account_secrets from authenticated;
grant all  on public.connected_account_secrets to service_role;

alter table public.connected_account_secrets enable row level security;
-- Intencional: nenhuma policy. Só service_role bypassa RLS.

-- =========================================================================
-- oauth_states  (PKCE state; service_role only)
-- =========================================================================
create table public.oauth_states (
  state           text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null check (provider in ('faceit')),
  code_verifier   text not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '10 minutes')
);

revoke all on public.oauth_states from public, anon, authenticated;
grant all  on public.oauth_states to service_role;

alter table public.oauth_states enable row level security;
-- Sem policies. Só service_role.

-- =========================================================================
-- sync_jobs
-- =========================================================================
create table public.sync_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null check (provider in ('faceit')),
  status          text not null check (status in ('pending','running','success','error')),
  matches_synced  integer not null default 0,
  error           text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

grant select on public.sync_jobs to authenticated;
grant all    on public.sync_jobs to service_role;

alter table public.sync_jobs enable row level security;

create policy "sync_jobs: owner reads own"
  on public.sync_jobs for select to authenticated
  using (user_id = (select auth.uid()));

-- Impede sync duplicado (botão + cron simultâneos):
create unique index sync_jobs_one_active
  on public.sync_jobs (user_id, provider)
  where status in ('pending','running');

-- =========================================================================
-- matches
-- =========================================================================
create table public.matches (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  provider           text not null check (provider in ('faceit')),
  match_id           text not null,
  game               text not null,               -- 'cs2'
  map                text,
  competition_type   text,
  played_at          timestamptz not null,        -- motor ordena por isso
  duration_seconds   integer,
  rounds_won         integer,
  rounds_lost        integer,
  result             text not null check (result in ('win','loss','draw')),
  raw                jsonb not null,              -- payload íntegro para reprocessar
  created_at         timestamptz not null default now(),
  unique (user_id, provider, match_id)
);

grant select, insert, update, delete on public.matches to authenticated;
grant select                          on public.matches to anon;
grant all                             on public.matches to service_role;

alter table public.matches enable row level security;

create policy "matches: owner or public profile reads"
  on public.matches for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.is_profile_public(user_id)
  );

create policy "matches: service_role writes"
  on public.matches for all to service_role
  using (true) with check (true);

create index matches_user_played_at_idx
  on public.matches (user_id, played_at desc);

-- =========================================================================
-- match_stats  (PK = match_id; 1:1 com matches)
-- =========================================================================
create table public.match_stats (
  match_id         text primary key,
  user_id          uuid not null references auth.users(id) on delete cascade, -- denormalizado
  kills            integer not null default 0,
  deaths           integer not null default 0,
  assists          integer not null default 0,
  mvps             integer not null default 0,
  rounds           integer not null default 0,
  headshots        integer not null default 0,
  headshot_pct     numeric not null default 0,   -- escala 0-100
  kd_ratio         numeric not null default 0,
  kr_ratio         numeric not null default 0,
  adr              numeric not null default 0,
  rating_approx    numeric not null default 0,
  won              boolean not null default false,
  created_at       timestamptz not null default now()
);

grant select, insert, update, delete on public.match_stats to authenticated;
grant select                          on public.match_stats to anon;
grant all                             on public.match_stats to service_role;

alter table public.match_stats enable row level security;

create policy "match_stats: owner or public profile reads"
  on public.match_stats for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.is_profile_public(user_id)
  );

create policy "match_stats: service_role writes"
  on public.match_stats for all to service_role
  using (true) with check (true);

create index match_stats_user_idx on public.match_stats (user_id);

-- =========================================================================
-- index_snapshots  (SEM UNIQUE; dedupe em código, §6)
-- =========================================================================
create table public.index_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  total_score           numeric not null,
  performance_score     numeric not null,
  consistency_score     numeric not null,
  evolution_score       numeric not null,
  participation_score   numeric not null,
  matches_considered    integer not null,
  is_calibrating        boolean not null,
  breakdown             jsonb not null,     -- pilares detalhados + insights
  computed_at           timestamptz not null default now()
);

grant select on public.index_snapshots to authenticated;
grant select on public.index_snapshots to anon;
grant all    on public.index_snapshots to service_role;

alter table public.index_snapshots enable row level security;

create policy "index_snapshots: owner or public profile reads"
  on public.index_snapshots for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.is_profile_public(user_id)
  );

create policy "index_snapshots: service_role writes"
  on public.index_snapshots for all to service_role
  using (true) with check (true);

create index index_snapshots_user_computed_at_idx
  on public.index_snapshots (user_id, computed_at desc);
```

---

## 3. RLS — regras gerais e helper canônico

- Toda tabela em `public` tem RLS ligado.
- Toda `CREATE TABLE` tem `GRANT` explícito no mesmo migration.
- `connected_account_secrets` e `oauth_states` têm RLS ligado e **zero
  policies**: só `service_role` acessa (bypassa RLS).
- Dados públicos de perfil (`matches`, `match_stats`, `index_snapshots`)
  usam a fórmula canônica:
  ```sql
  using (user_id = (select auth.uid()) or public.is_profile_public(user_id))
  ```
  aplicada `to anon, authenticated`. Sem essa policy o `/p/:username`
  deslogado não funciona.

### Helper `is_profile_public(uuid)`

Assinatura literal, não renomear, não trocar por versão que recebe `text`:

```sql
create or replace function public.is_profile_public(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_public from public.profiles where id = p_id),
    false
  )
$$;

revoke execute on function public.is_profile_public(uuid) from public;
grant  execute on function public.is_profile_public(uuid) to anon, authenticated;
```

`SECURITY DEFINER` + `set search_path` são obrigatórios. Sem `grant execute
to anon`, `/p/:username` deslogado retorna vazio silenciosamente.

---

## 4. AUTENTICAÇÃO

- **Login = Discord** via `supabase.auth.signInWithOAuth({ provider:
  'discord' })`. Email/senha também aceitos (fallback). Nada de "Entrar com
  FACEIT" — FACEIT não é IdP.
- **Provider config** (Discord OAuth app, redirect URLs) é responsabilidade
  do owner do projeto, configurado no dashboard Supabase. O código só
  chama o SDK.
- Signup dispara `handle_new_user` (§2) que cria `profiles` com username
  provisório. Onboarding pede username definitivo.
- Rotas autenticadas ficam em `src/routes/_authenticated/`. O gate
  `_authenticated/route.tsx` é o managed do integration Supabase
  (`ssr: false`, `beforeLoad` chama `supabase.auth.getUser()`, redireciona
  a `/auth` quando não há user). Não reescrever.
- Server functions autenticadas usam `requireSupabaseAuth` middleware.
- **`delete-account`** (edge function, service_role) apaga o auth.user; o
  cascade limpa `profiles`, `connected_accounts` → `connected_account_secrets`,
  `oauth_states`, `sync_jobs`, `matches`, `match_stats`, `index_snapshots`.

---

## 5. EDGE FUNCTIONS

Todas em `supabase/functions/`. Helpers compartilhados em
`supabase/functions/_shared/`.

### Secrets exigidos (backend only)

| Nome                    | Uso                                                     |
| ----------------------- | ------------------------------------------------------- |
| `FACEIT_CLIENT_ID`      | OAuth client ID (Basic auth no token endpoint)          |
| `FACEIT_CLIENT_SECRET`  | OAuth client secret (Basic auth no token endpoint)      |
| `FACEIT_REDIRECT_URI`   | URL de callback registrada no FACEIT Developer Portal   |
| `FACEIT_API_KEY`        | Data API v4 server-side (Bearer, único uso pra dados)   |
| `TOKEN_ENC_KEY`         | AES-GCM 256-bit em base64 (32 bytes decodificados)      |

Nenhum destes vaza pro frontend. Não existe `VITE_FACEIT_*`.

### Criptografia de tokens (AES-GCM Web Crypto)

Helper em `_shared/crypto.ts`:

```ts
// Deriva CryptoKey uma vez por invocação a partir de TOKEN_ENC_KEY (base64, 32B).
async function getKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(Deno.env.get('TOKEN_ENC_KEY')!), c => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}

export async function encryptToken(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(),
      new TextEncoder().encode(plain))
  );
  return { ct, iv };
}

export async function decryptToken(ct: Uint8Array, iv: Uint8Array) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await getKey(), ct);
  return new TextDecoder().decode(plain);
}
```

Grava em `connected_account_secrets` sempre criptografado. `refresh_token`
pode ser null (FACEIT nem sempre retorna).

### 5.1 `faceit-oauth-start`  (`verify_jwt=true`, POST)

Fluxo FACEIT é **não-padrão**: `authorize` **não aceita `redirect_uri` nem
`scope` como query params**. Só `response_type=code`, `client_id`, `state`
e PKCE (`code_challenge`, `code_challenge_method=S256`).

1. Recebe user autenticado via middleware.
2. Gera `state` (`crypto.randomUUID()`) e `code_verifier` (43+ chars random
   base64url). Deriva `code_challenge = base64url(SHA-256(verifier))`.
3. Persiste `{ state, user_id, provider:'faceit', code_verifier }` em
   `oauth_states`.
4. Retorna `{ authorize_url }` apontando para:
   ```
   https://accounts.faceit.com/?response_type=code
     &client_id={FACEIT_CLIENT_ID}
     &state={state}
     &code_challenge={challenge}
     &code_challenge_method=S256
   ```
   O `redirect_uri` está configurado no lado do FACEIT.

### 5.2 `faceit-oauth-callback`  (`verify_jwt=false`, GET)

FACEIT redireciona pra `FACEIT_REDIRECT_URI` (esta função) com `?code=...&state=...`.

1. Recupera row de `oauth_states` por `state`. Se não existe ou expirou →
   redirect `/connect?error=invalid_state`.
2. Troca `code` por tokens em `POST https://api.faceit.com/auth/v1/oauth/token`,
   body `application/x-www-form-urlencoded`:
   ```
   grant_type=authorization_code
   code={code}
   code_verifier={verifier}
   ```
   Header: `Authorization: Basic base64(client_id:client_secret)`.
   Se 4xx → redirect `/connect?error=token_exchange`.
3. Chama `GET https://api.faceit.com/auth/v1/resources/userinfo` com
   `Authorization: Bearer {access_token}`. Extrai `guid`. Se sem `guid` →
   `?error=no_guid`.
4. Upsert em `connected_accounts` `(user_id, provider='faceit',
   provider_user_id=guid, nickname)`. Se `guid` já pertence a outro
   `user_id` → redirect `/connect?error=already_linked` (não sobrescreve).
5. Criptografa `access_token` e `refresh_token` (se houver). Grava em
   `connected_account_secrets`.
6. Insere `sync_jobs (user_id, provider='faceit', status='pending')`.
   Se já existe active (unique parcial) → mantém o existente.
7. Deleta a row de `oauth_states`.
8. Redirect: se veio de onboarding → `/onboarding?step=3`, senão →
   `/connect?ok=1`.

### 5.3 `faceit-sync`  (`verify_jwt=true`, POST)

**Não descriptografa token de usuário. Não seta `needs_reauth`.** Dados
públicos de jogador na Data API v4 usam `FACEIT_API_KEY` server-side.
Access token OAuth (24h) é irrelevante ao sync — só serviu ao userinfo
no callback.

1. Middleware injeta `userId`. Busca `connected_accounts` do user com
   `provider='faceit'`. Sem conta → 404.
2. Atualiza `sync_jobs`: pega a row `pending` mais recente (ou insere
   nova) e marca `status='running'`, `started_at=now()`. Se já tem
   outra `running` (unique parcial impede) → retorna 409.
3. Chama Data API v4 com `Authorization: Bearer {FACEIT_API_KEY}`:
   - `GET https://open.faceit.com/data/v4/players/{guid}/history?game=cs2&from=0&limit=100`
     (`from` sempre presente, começa em 0; pagina até esgotar ou 100 max).
   - Para cada match, `GET .../matches/{match_id}/stats` retorna teams e
     rounds com stats por player.
4. Backoff em 429: **2s, 4s, 8s, máx 3 tentativas**. Depois disso → aborta
   com `status='error'`.
5. Sem CS2 → conclui com `status='success'`, `matches_synced=0`.
6. Persiste `matches` (upsert por `(user_id, provider, match_id)`, `raw`
   guarda payload íntegro pra reprocessamento) e `match_stats` (upsert
   por `match_id`).
7. Ao fim: `computeIndex(userId)` in-process (§6). Marca
   `sync_jobs.status='success'`, `finished_at=now()`,
   `matches_synced=N`. Atualiza `connected_accounts.last_synced_at`.
8. Timeout global (edge function): se ultrapassar, `status='error'`,
   `error='timeout'`.

### 5.4 `faceit-sync-all`  (`verify_jwt=true`, POST) — orquestrador do cron

Chamado pelo `pg_cron` a cada 6h com `service_role` no header.

1. Middleware valida JWT. Confere `claims.role = 'service_role'`. Senão
   → 403.
2. Itera `connected_accounts where provider='faceit' and needs_reauth=false`
   **em série** (não paralelo — evita rate limit).
3. Para cada conta, chama `faceit-sync` internamente (invoke). Skip se
   já houver `sync_jobs` ativo (unique parcial).
4. Retorna `{ ran: N, skipped: M }`.

### 5.5 `compute-index`  (`verify_jwt=true`, POST) — wrapper HTTP

Só wrapper. Chama `computeIndex(userId)` do `_shared/index-engine.ts`.
Usado por debug e por eventual recomputo manual.

### 5.6 `delete-account`  (`verify_jwt=true`, POST)

Middleware valida token do usuário. Usa `service_role` internamente para
chamar `auth.admin.deleteUser(userId)`. Cascade cuida do resto.

### Cron (pg_cron + pg_net + Vault, executar via `supabase--insert`)

```sql
-- Habilitar extensões (uma vez):
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Armazenar service_role no Vault (uma vez):
select vault.create_secret(
  '<SERVICE_ROLE_KEY>',
  'service_role_key',
  'Service role para faceit-sync-all'
);

-- Agenda a cada 6h:
select cron.schedule(
  'faceit-sync-all-every-6h',
  '0 */6 * * *',
  $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/faceit-sync-all',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

---

## 6. ASCEND INDEX v1 — FÓRMULA EXATA

**Não invente nada aqui.** O Index final terá 11 pilares; hoje só 4 têm fonte de dados. Os outros 7 aparecem na UI como bloqueados — é intencional e faz parte do produto.

### Helper

```ts
// linear por partes, clamp em [0,1]. Pré-condição: low < mid < high.
function norm(x: number, low: number, mid: number, high: number): number {
  if (!Number.isFinite(x)) throw new Error(`norm: input não-finito: ${x}`);
  if (x <= low) return 0;
  if (x >= high) return 1;
  if (x <= mid) return 0.5 * (x - low) / (mid - low);
  return 0.5 + 0.5 * (x - mid) / (high - mid);
}
```

Métrica ausente/null **nunca** chega no `norm()` — é tratada antes, pela regra de redistribuição.

### `rating_approx` (por partida)

```
0.45 * norm(kr_ratio,     0.50, 0.68, 0.85)
0.25 * norm(adr,          55,   75,   95)
0.20 * norm(kd_ratio,     0.80, 1.05, 1.35)
0.10 * norm(headshot_pct, 35,   48,   60)
```

⚠️ `headshot_pct` está na escala **0–100** (47.0 = 47%). `norm(0.47, 35, 48, 60)` retorna **0 sempre** e zeraria 10% do rating de todo jogador sem erro visível. Valide `0 <= v <= 100`; fora da faixa = trate como ausente e logue.

**Métrica ausente (ADR é o caso comum):** média ponderada só sobre as disponíveis —
`rating_approx = Σ(wᵢ × normᵢ) / Σ(wᵢ)`. Sem ADR: `(0.45·norm_kr + 0.20·norm_kd + 0.10·norm_hs) / 0.75`.
Com menos de 2 das 4 métricas: exclua a partida do Index (`rating_approx = null`; ela continua em `matches`/`match_stats`). Registre no `breakdown` quais métricas faltaram e em quantas partidas.

> **Nota de arquitetura:** as bandas são fixas porque no lançamento não existe base de usuários pra calcular percentil. Isole a normalização atrás dessa única função — quando houver massa, troca-se banda fixa por percentil dentro da coorte (mesmo nível/elo) sem tocar em mais nada.

### Pilar 1 — Performance (peso 40%)

Média de `rating_approx` das últimas 30 partidas. Já é 0..1.

### Pilar 2 — Consistência (peso 25%)

```
n = partidas consideradas (máx. 30 mais recentes)
se n < 2                  → consistency = 0.5   (neutro)
mean = média(rating_approx)
se mean < 0.1             → consistency = 0     (fundo da escala: cv explode e não significa nada)
sd = desvio-padrão AMOSTRAL (divisor n−1; = stddev_samp do Postgres)
cv = sd / mean
consistency = 1 − norm(cv, 0.12, 0.24, 0.40)
```

### Pilar 3 — Evolução (peso 20%)

⚠️ **Ordene por `played_at ASC` (mais antiga primeiro).** A query natural pra "últimas 30" é `ORDER BY played_at DESC` — se indexar nessa ordem, o slope **inverte de sinal** e o produto mostra "em queda" pra quem está melhorando.

```
x_i = 0,1,...,n-1 (mais antiga = 0); y_i = rating_approx
slope = Σ(x_i−x̄)(y_i−ȳ) / Σ(x_i−x̄)²
se n < 10 ou denominador = 0 → evolution = 0.5 (slope com poucas partidas é ruído)
evolution = norm(slope, -0.004, 0, +0.004)
```

Unidade: pontos de rating (escala 0–1) por partida. Sanidade: ±0.004 × 30 = ±0.12 de deriva total pra saturar o pilar.

### Pilar 4 — Participação (peso 15%)

```
participation = 0.5 * norm(dias_ativos, 2, 8, 16)
              + 0.5 * norm(partidas,    5, 25, 50)
```

As janelas são **intencionalmente diferentes**: pilares 1–3 medem skill sobre as últimas 30 **PARTIDAS**; participação mede hábito sobre os últimos 30 **DIAS**. Não uniformize.

`dias_ativos` = dias-calendário distintos com ≥1 partida, no fuso **America/Sao_Paulo**:
`count(distinct (played_at AT TIME ZONE 'America/Sao_Paulo')::date)` filtrando `played_at >= now() - interval '30 days'`.

`partidas` = `count(*)` no mesmo filtro de 30 dias.

### Score final

```
total_score = Math.round(1000 × (0.40·performance + 0.25·consistency
                               + 0.20·evolution + 0.15·participation))
```

Inteiro em [0, 1000]. Pesos somam 1.0.

### Calibração e cadência de snapshot

- `compute-index` **sempre** calcula e insere quando n ≥ 1 — o histórico desde o dia 1 é o produto — com `is_calibrating = (matches_considered < 10)`. Com n = 0, não insira.
- A UI **nunca** exibe `total_score` de snapshot com `is_calibrating = true`. Mostra "Calibrando — faltam N partidas" (N = 10 − matches_considered). O gráfico de evolução só plota `is_calibrating = false`.
- **Dedupe:** antes de inserir, compare com o último snapshot a tupla (`matches_considered`, `total_score`, 4 pilares arredondados a 4 casas). Tudo igual → não insira. *(Sem isso o cron de 6h cria 4 snapshots idênticos por dia.)* Participação muda sozinha com a janela deslizante, então snapshots legítimos continuam acontecendo.
- **Delta do dashboard:** `total_score` do snapshot mais recente menos o do mais recente com `computed_at <= now() - interval '7 days'`. Se não existir o antigo, **oculte o delta** — nada de 0 fake.

### Pilares bloqueados (renderize, desabilitados, com a fonte declarada)

| Pilar | Fonte futura |
|---|---|
| Comunicação | Peer review do time |
| Trabalho em equipe | Peer review do time |
| Liderança | Avaliação de treinador |
| Disciplina | Check-in de rotina e treinos |
| Fair Play | Reports e punições das plataformas |
| Conteúdo | Integração Twitch / YouTube |
| Marca pessoal | ASCEND Studio |

### Transparência é obrigatória

Todo pilar exibido é clicável e abre um painel com os inputs crus do `breakdown`. O usuário sempre consegue responder "por que meu score é esse?". Não é feature secundária — é o que separa a ASCEND de uma caixa-preta.

---

## 7. INSIGHTS DETERMINÍSTICOS (sem LLM)

Card "Leitura da ASCEND" no dashboard, com até 3 frases calculadas por regra a partir dos dados reais. Nenhuma chamada de IA, nenhum SDK. Módulo isolado `insights.ts` dentro do compute-index; persista as frases no `breakdown`. **Este módulo é a semente da futura camada de IA.**

- **Evolução:** se |variação| da média de `rating_approx` (últimas 10 vs 10 anteriores) ≥ 5% → "Seu rating médio {subiu|caiu} {X}% nas últimas 10 partidas."
- **Consistência:** cv < 0,12 → "Você está jogando de forma muito consistente."; cv > 0,40 → "Sua performance está oscilando acima do normal."
- **Mapa:** com ≥3 partidas no mesmo mapa nos últimos 30 dias → "Seu melhor mapa do mês foi {mapa} (rating médio {X})."
- **Ritmo:** "Você jogou {N} partidas em {M} dias ativos nos últimos 30 dias."

Cada frase só renderiza se o gatilho existir. Com <10 partidas o card não aparece. Números em pt-BR. Proibida frase genérica de preenchimento.

---


## 8. TABELA DE MAPEAMENTO FACEIT → SCHEMA

Data API v4 retorna stats como **strings**. Parse com `Number(...)`.

### Match-level (raiz de `matches/{id}/stats.rounds[0].round_stats`)

| FACEIT key             | Schema (`matches`)     | Notas                                   |
| ---------------------- | ---------------------- | --------------------------------------- |
| `Map`                  | `map`                  | string                                  |
| `Rounds`               | -                      | usado para calcular rounds_won/lost     |
| `Winner`               | -                      | comparar com faction do player          |
| (raiz `match` payload) | `match_id`             | string                                  |
| (raiz)                 | `played_at`            | `finished_at` do payload, convertido    |
| (raiz)                 | `duration_seconds`     | `finished_at - started_at`              |
| (raiz)                 | `competition_type`     | `competition_type` do payload           |
| (raiz)                 | `game`                 | `'cs2'`                                 |
| (payload inteiro)      | `raw`                  | jsonb íntegro                           |
| derivado do Winner     | `result`               | `'win' \| 'loss' \| 'draw'`             |

### Player-level (dentro de `teams[].players[].player_stats`)

| FACEIT key       | Schema (`match_stats`) | Escala/tipo                     |
| ---------------- | ---------------------- | ------------------------------- |
| `Kills`          | `kills`                | int                             |
| `Deaths`         | `deaths`               | int                             |
| `Assists`        | `assists`              | int                             |
| `MVPs`           | `mvps`                 | int                             |
| `Headshots`      | `headshots`            | int                             |
| `Headshots %`    | `headshot_pct`         | **0–100** (não 0–1)             |
| `K/D Ratio`      | `kd_ratio`             | numeric                         |
| `K/R Ratio`      | `kr_ratio`             | numeric                         |
| `ADR`            | `adr`                  | numeric                         |
| `Result`         | `won`                  | `'1'` → true                    |
| (round_stats)    | `rounds`               | int                             |
| derivado         | `rating_approx`        | `ratingApprox(...)` do motor    |

### History → matches list

| FACEIT (`items[]`) | Schema (`matches`)    |
| ------------------ | --------------------- |
| `match_id`         | `match_id`            |
| `finished_at`      | `played_at` (unix→ts) |
| `competition_type` | `competition_type`    |
| `game_id`          | `game` (`'cs2'`)      |

---

## 9. TELAS

Rotas exaustivas. Nada além disso.

### `/` — Landing

Layout editorial **assimétrico**. `head()` próprio (título, description,
OG). Sem hero centralizado.

- H1 à **esquerda**. Texto direto, sem promessa vaga.
- **Um** CTA: **"Entrar com Discord"** → `/auth`.
- Número gigante como arte tipográfica (decorativo, não é métrica real).
- 3 passos numerados com eyebrows `01`, `02`, `03`.
- Sem badge acima do H1, sem cards com ícone, sem depoimento, sem preço,
  sem grid de features, sem gradiente roxo.

### `/auth`

- Form email/senha + botão "Entrar com Discord".
- Sem "Entrar com FACEIT" nem em qualquer outra tela.

### `/onboarding` — 3 passos

Rota autenticada.

1. **Username**: input único; valida único; grava em `profiles`.
2. **Conectar FACEIT**: CTA para `/connect` (etapa 4).
3. **Aguardando sync**: polling em `sync_jobs` **a cada 2s** até
   `status IN ('success','error')`. Sem Realtime. Depois → `/dashboard`.

### `/connect`

- FACEIT: card ativo com estados (conectar / sincronizando /
  ressincronizar / desconectar). Botão "Sincronizar agora" desabilitado
  se há `sync_jobs` ativo.
- Steam, Riot: **disabled com badge "Em integração"**. Sem página, sem
  rota, sem `TODO`.

### `/dashboard`

Autenticado. 6 seções na ordem exata:

1. `01 / ÍNDICE` — número gigante alinhado à **esquerda**, cor `foreground`
   (branco), **fora de card**, direto no fundo. Nunca laranja, nunca
   centralizado, nunca dentro de card.
2. `02 / EVOLUÇÃO` — gráfico Recharts. Cores 100% via tokens
   (`var(--color-primary)` etc). Zero `#8884d8`.
3. `03 / PILARES` — grid dos 4 pilares. Bloqueados usam `LockedCard`
   (border **dashed**, bg transparente). Sem `opacity-50`, sem blur, sem
   "em breve".
4. `04 / LEITURA` — insights lidos de `index_snapshots.breakdown.insights`.
5. `05 / PARTIDAS` — lista **tabular**, cada linha com barra vertical de
   2px na lateral (verde/vermelho apenas na barra). Sem card colorido,
   sem badge WIN/LOSS.
6. `06 / SINCRONIZAÇÃO` — status do último `sync_jobs`, botão
   ressincronizar (disabled quando há job ativo).

**Screenshot-checks** (aplicados na revisão):

1. Número do Index: esquerda, branco, fora de card.
2. Partidas: tabular, sem card colorido, barra 2px.
3. Pilares bloqueados: border dashed, bg transparente.
4. Mobile 360px: sem scroll horizontal em nenhuma seção.

**Estados**:

- **Vazio**: sem `connected_accounts` FACEIT → CTA para `/connect`.
- **Calibração**: `is_calibrating=true` → barra de 10 blocos (preenchida
  = `matches_considered`).
- **Erro de sync**: banner na seção 06.
- **Loading**: skeleton com a forma do layout, nunca spinner.

### `/settings`

- Editar `display_name`, `username`, `avatar_url`.
- Toggle `is_public`.
- Botão "Excluir conta" → `delete-account` (confirmação dupla).

### `/p/:username` — perfil público

SSR. Loader chama server function pública (publishable key). Busca
`profiles` por `username`; se `null` ou `is_public=false` → `throw
notFound()` (404 real, não "acesso negado"). Lê `matches`, `match_stats`,
`index_snapshots` via policies públicas (§3).

`head({ loaderData })` gera **OG tags server-side por rota**:
`og:title`, `og:description`, canonical, `og:url`. `og:image` só se houver
imagem real, senão omite.

### `/privacidade` e `/termos`

Rotas públicas estáticas, mínimas. Sem CTA.

---

## 10. ROTEAMENTO E GUARDAS

- Rotas autenticadas: `src/routes/_authenticated/*`. Gate managed
  (`ssr: false`, `beforeLoad` chama `supabase.auth.getUser()`). Não
  reescrever.
- Rotas públicas: SSR on. `head()` por rota (nunca react-helmet).
- OG estática genérica no `__root.tsx` como fallback (sem `og:image` no
  root).
- `_authenticated/` nunca é destino de `redirect_uri` OAuth. Callback de
  qualquer OAuth (Discord ou FACEIT) volta pra rota pública.
- Não usar `beforeLoad` redirect-to-`/auth` em rota top-level SSR.

---

## 11. COMPONENTES DE ASSINATURA

Todos em `src/components/ascend/`.

- **`NumberDisplay`** — número gigante (Archivo wdth 125%). Props: `value`,
  `align?: 'left' | 'right'` (default `left`), `size?: 'xl' | 'lg'`. Sem
  card, sem bg. Cor default `foreground`.
- **`SectionHeader`** — `NN / TÍTULO` em mono. Props: `number` (2 dígitos),
  `title`.
- **`Eyebrow`** — texto mono pequeno, uppercase, muted.
- **`Divider`** — linha 1px, `border-muted`.
- **`MonoLabel`** — label mono uppercase.
- **`LockedCard`** — border **dashed**, bg **transparente**, sem opacity.
  Renderiza título + descrição do que está por vir. Uso: pilares Steam/Riot.

### Shell

- **Desktop**: sidebar fixa à esquerda com nav vertical. Logo topo,
  usuário rodapé.
- **Mobile**: header fixo topo, drawer com menu.

### Tipografia (self-hosted, zero CDN)

- **Display**: `@fontsource-variable/archivo` + `@fontsource-variable/archivo/wdth.css`
  (obrigatório pra `font-stretch: 125%`).
- **Sans**: `@fontsource-variable/schibsted-grotesk`.
- **Mono**: `@fontsource/spline-sans-mono`.

Imports no topo de `src/styles.css`, antes de `@theme`.

---

## 12. DESIGN TOKENS

Definidos em `src/styles.css` (Tailwind v4) via `@theme inline`. Zero cor
hard-coded em componentes. Zero `text-white`, `bg-black`, `bg-[#...]`.

Paleta oklch (referência; ajustar tons finais conforme identidade):

```css
:root {
  --background:        oklch(0.14 0 0);
  --foreground:        oklch(0.98 0 0);
  --muted:             oklch(0.22 0 0);
  --muted-foreground:  oklch(0.65 0 0);
  --border:            oklch(0.28 0 0);
  --primary:           oklch(0.70 0.19 45);   /* laranja acento */
  --primary-foreground:oklch(0.15 0 0);
  --destructive:       oklch(0.62 0.22 25);
  --success:           oklch(0.72 0.18 145);

  --font-display: "Archivo Variable", system-ui, sans-serif;
  --font-sans:    "Schibsted Grotesk Variable", system-ui, sans-serif;
  --font-mono:    "Spline Sans Mono", ui-monospace, monospace;
}
```

Regras de uso:

- Número do Ascend Index: `foreground` (branco), esquerda, fora de card.
  Nunca `primary`.
- `primary` (laranja) é **acento**: CTA único, barra positiva, highlight.
  Nunca em texto corrido, nunca em background largo.
- Estados negativos: `destructive`. Positivos: `success`. Neutros: `muted-foreground`.
- Recharts: passar cores via `var(--color-primary)`, `var(--color-destructive)`,
  etc. Zero literal.
- `LockedCard`: `border-dashed border-border bg-transparent`. Sem opacity.

---

## 13. DEFINITION OF DONE

Checklist obrigatório antes de considerar qualquer etapa concluída:

- [ ] Zero dado fake em qualquer camada (migration, dev, teste, snapshot).
- [ ] Zero rota/menção a Arena, Academy, Studio, Partners, Store, Wallet,
      Careers, Teams, Matchmaking.
- [ ] Zero `VITE_FACEIT_*`. Todos os secrets FACEIT + `TOKEN_ENC_KEY`
      configurados via `add_secret`.
- [ ] Tokens OAuth em `connected_account_secrets`, criptografados AES-GCM,
      RLS on, zero policies, revoke total de anon/authenticated.
- [ ] Helper `is_profile_public(uuid)` `SECURITY DEFINER stable`, `grant
      execute to anon, authenticated`.
- [ ] Policies públicas em `matches`, `match_stats`, `index_snapshots` com
      `using (user_id = (select auth.uid()) or public.is_profile_public(user_id))`
      to `anon, authenticated`.
- [ ] `sync_jobs_one_active` (unique parcial) impede sync duplicado.
- [ ] `matches` tem `raw jsonb NOT NULL`, `played_at`, `game`, `map`,
      `rounds_won`, `rounds_lost`, `duration_seconds`, `result`.
- [ ] `match_stats` tem PK `match_id`, `user_id` denormalizado NOT NULL,
      `adr`, `kr_ratio`, `headshots`, `rating_approx`, `headshot_pct` (0–100).
- [ ] `index_snapshots` sem `UNIQUE`; dedupe em código (matches_considered
      + 4 pilares a 4 casas).
- [ ] `faceit-sync` usa **apenas `FACEIT_API_KEY`** server-side. Não
      descriptografa token de usuário. Não seta `needs_reauth` por refresh.
- [ ] `faceit-sync-all` `verify_jwt=true`, chamado pelo cron com
      `service_role` do Vault.
- [ ] Cron `pg_cron` agendado a cada 6h.
- [ ] Motor determinístico: rodar duas vezes o mesmo input produz o mesmo
      snapshot; dedupe em código impede snapshot idêntico.
- [ ] Motor ordena por `played_at` ASC em toda janela temporal.
- [ ] `headshot_pct` na escala 0–100 (não 0–1) em todo lugar.
- [ ] Insights lidos de `breakdown.insights`, gerados pelo motor,
      determinísticos.
- [ ] Dashboard passa os 4 screenshot-checks (número esquerda/branco/sem
      card; partidas tabulares; pilares bloqueados dashed transparente;
      mobile 360px sem scroll horizontal).
- [ ] OG tags server-side por rota (não react-helmet). `/p/:username`
      privado/inexistente → 404 real.
- [ ] Landing: H1 à esquerda, UM CTA "Entrar com Discord", número gigante
      decorativo, 3 passos numerados. Sem hero centralizado, sem cards
      com ícone, sem preço.
- [ ] Login = Discord. FACEIT nunca aparece como opção de login.
- [ ] Zero cor hard-coded. Recharts 100% via tokens CSS.
- [ ] Fontes self-hosted (`@fontsource*`). Zero CDN, zero `<link>` externo
      a fontes.
- [ ] Shell: sidebar desktop, header+drawer mobile.
- [ ] `_authenticated/route.tsx` intacto (managed).
- [ ] Build passa, typecheck passa, sem warnings de resolução.
