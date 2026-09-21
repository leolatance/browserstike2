# Supabase — subindo o seu próprio projeto pra desenvolver o online

> O projeto de produção (`browserstrike2.vercel.app`) é do autor e não aceita chaves de terceiros. Pra mexer em conta, sync, queue online, patente, ranking e x1 entre amigos, suba um projeto seu (o plano grátis basta). Sem isso o app roda 100% local — é intencional.

## 1. Projeto e chaves

1. Crie um projeto em <https://supabase.com/dashboard>.
2. Em **Project Settings → API** copie a **Project URL** e a **anon key** pra `apps/web/.env.local` (modelo em `.env.example`). A URL é a do projeto (`https://xxxx.supabase.co`), não a do REST.
3. Reinicie o `npm run dev`.

## 2. Migrações (na ordem)

Os arquivos em `supabase/migrations/` são idempotentes e devem rodar em ordem de nome. Duas opções:

- **CLI**: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
- **SQL Editor** do dashboard: cole cada arquivo, do mais antigo pro mais novo.

O que elas criam: perfis e personagens (com trigger `characters_guard` — recompensas só via servidor), partidas e participações, temporadas + MMR, views materializadas de ranking (`ladder_rating`, `ladder_mmr`) atualizadas por **pg_cron** a cada 5 min (`refresh_ladders`; a extensão `pg_cron` precisa estar habilitada em **Database → Extensions**), bucket `avatars` (público pra leitura), tabelas de x1 (`x1_invites`, `x1_matches`, `x1_ratings`, view `ladder_x1`) e `public_profiles_v2`.

## 3. Auth

Em **Authentication → URL Configuration**: Site URL = `http://localhost:5173` e adicione a mesma em Redirect URLs. Login por e-mail (magic link) já vem ligado; Google é opcional (**Providers → Google**).

## 4. Edge functions

O engine é empacotado pra Deno em `supabase/functions/_shared/engine.js` (gerado por `scripts/bundle-engine.sh`; regenerar sempre que mexer no engine).

```bash
npx supabase functions deploy queue_match --project-ref <ref>
npx supabase functions deploy x1_create --project-ref <ref>
```

As functions usam `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`, injetadas automaticamente pelo Supabase. Nenhum segredo vai pro repositório.

Testes: `npm run test:deno`.

## 5. Realtime

Usado pelo x1 online (broadcast + presença em canais públicos). Vem ligado por padrão; nada a configurar.

## Checklist rápido

- [ ] `.env.local` com URL e anon key
- [ ] migrações aplicadas, `pg_cron` habilitado
- [ ] URL Configuration com o localhost
- [ ] functions deployadas
