---
title: "Bots com cartas"
labels: [engine, balance]
---
**GDD:** 5.7 (Bots) · 6 (Cartas).

## Problema
Bots jogam sem build. Quanto mais cartas o jogador tem, mais fácil fica a queue solo, e o gate de rating das cartas mede contra bots "nus".

## Proposta
`generateBotTeam` recebe um nível de build (0–6 slots) e sorteia cartas coerentes com a classe (tags), nível I–III conforme a média de atributos. A queue solo nivela os bots pela build do jogador, não só pela média de atributos.

## Pronto quando
- Sorteio determinístico via `Rng` (regra 1 do CLAUDE.md), dados em `data/cards.ts`.
- `test/balance.test.ts`: novo cenário "builds iguais dos dois lados" mantém favorito 62–68%; os gates de cartas continuam passando.
- GDD 5.7 atualizado.
