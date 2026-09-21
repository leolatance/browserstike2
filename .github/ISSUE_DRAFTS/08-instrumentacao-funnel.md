---
title: "Instrumentação e funnel"
labels: [web, online]
---
**GDD:** — (não está no GDD; engenharia de produto).

## Pergunta que quero responder
Quantos criam boneco → jogam a primeira partida → voltam no dia seguinte → criam conta → jogam online.

## Proposta
Eventos mínimos (`character_created`, `first_match`, `session_start`, `login`, `online_match`) sem PII, guardados em uma tabela `events` (Supabase) só pra quem tem conta, e um contador local (Dexie) pra quem não tem. Sem terceiros de analytics. Opt-out no perfil.

## Pronto quando
- Tabela + RLS (insert só o próprio, select só service role).
- Uma query SQL de funnel em `supabase/README.md`.
- Zero impacto no modo 100% local (nada de rede sem conta).
