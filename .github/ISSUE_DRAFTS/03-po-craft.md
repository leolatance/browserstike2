---
title: "Pó → craft de cartas"
labels: [web, progression]
---
**GDD:** 6.2 (pó por cópia extra), 6.5 (boxes), 7 (duplicata → pó → craft, Fase 3).

## O que existe
Cópia extra de carta vira pó (`character.dust`). Nada gasta o pó ainda.

## Proposta
Tela em `/inventario`: craftar uma carta específica por raridade a um custo tabelado (definir a tabela em `data/cards.ts` ou `progression`, não hardcoded). Sugestão inicial: comum 50, incomum 150, rara 400, épica 1000 — números são ponto de partida, calibrar pelo drop rate do GDD 6.2.

## Pronto quando
- Tabela de custo no GDD 6.5 e em `data/`.
- Craft debita pó, cria a carta (ou sobe o nível se já tem), testes no store.
- Funciona offline (Dexie) e sincroniza igual às cartas de box.
