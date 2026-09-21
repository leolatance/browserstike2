---
title: "Lazy-load das rotas online"
labels: [web, good-first-issue]
---
**GDD:** — (engenharia; CLAUDE.md "Regras do app": Safari e Chrome mobile de primeira classe).

## Problema
O bundle único passou de 700 kB (aviso do Vite). As telas online (`QueueOnline`, `ResultOnline`, `Ranking`, `PublicProfile`, `Login`, `X1Invite`, `X1Online`) e o cliente Supabase entram no carregamento de quem joga 100% local.

## Pronto quando
- `React.lazy` + `Suspense` nas rotas online em `apps/web/src/App.tsx`; `@supabase/supabase-js` só no chunk delas.
- Chunk inicial abaixo de 400 kB gzip; medir com `npm run build -w @idle-strike/web` e colar os números no PR.
- PWA continua funcionando offline (precache dos chunks).
