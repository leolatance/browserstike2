---
title: "Segundo mapa"
labels: [engine, art, help-wanted]
---
**GDD:** 11 (Mapas: paródias, dois sites, mid, nome próprio, radar do zero).

## Escopo
Um segundo `MapDef` em `packages/engine/src/data/maps/`, com layout *inspirado* num clássico diferente do atual (ex.: um mapa de rotação longa/curta com mid fechado), nome próprio, áreas, rotas com tempos, spawns, sites, `mid`.

## Regras
Nada da Valve: sem nome real, sem radar real. Polígonos desenhados do zero.

## Pronto quando
- Testes como os de `test/map01.test.ts` (conectividade, tempos, cobertura das áreas).
- `test/balance.test.ts` roda nos dois mapas e os gates fecham nos dois (pode precisar de ajuste de rotas/tempos, não de fórmula).
- Radar renderiza no app; queue solo sorteia entre os mapas; GDD 11 atualizado.
