---
title: "Virada de temporada"
labels: [online, supabase]
---
**GDD:** 8.5 (Temporada: 30 dias, soft reset de MMR, rating/nível/cartas permanecem, recompensa de fim).

## O que existe
`seasons` e `current_season_id()` no banco; `softReset` no engine (`mmr.ts`). Não há job que feche uma temporada e abra a próxima.

## Proposta
Função SQL `rotate_season()` (idempotente) rodada por pg_cron diariamente: se a temporada atual venceu, cria a próxima, aplica o soft reset em `mmr`, grava a recompensa de fim (definir no GDD 8.5 — hoje diz só "recompensa") e refresca as ladders.

## Pronto quando
- Migração com a função + cron, testável no projeto local (`supabase/README.md`).
- Recompensa de fim definida no GDD e concedida pelo servidor (nunca pelo cliente — trigger `characters_guard`).
- Lobby mostra "temporada N acabou: você fechou em X" uma vez.
