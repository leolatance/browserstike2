# Idle Strike 2 — CLAUDE.md

> Leia este arquivo inteiro antes de qualquer tarefa. O design completo está em `docs/GDD.md`.
> Quando o GDD e este arquivo divergirem, este arquivo manda nas regras de engenharia e o GDD manda nas regras de jogo.

## O que é

**"CS pra quem não pode abrir o CS agora."** Um "CS2 de navegador": web app (PWA) onde o jogador cria um boneco e evolui ele até virar o melhor jogador de CS do jogo. Partidas 5x5 são **simuladas** a partir dos atributos dos bonecos e assistidas numa tela estilo **HLTV Live** (radar, kill feed, scoreboard, economia), com um **minigame opcional sincronizado aos duelos** do boneco. UI estilo **FACEIT**. Público: quem joga CS de verdade e está sem poder jogar (Mac, celular, trabalho, sem PC).

Não é manager, não é cartoon, não é casual. O jogador conhece CS — o jogo tem que respeitar isso.

## Stack (fixa)

- **React + Vite + TypeScript**, PWA
- **Motor de simulação em pacote TS puro** (`packages/engine`) — sem DOM, sem React, sem I/O. É importado pelo app e, na Fase 2, pelas edge functions do Supabase
- **Canvas 2D** para radar e minigames. Sem WebGL, sem engine de jogo, sem Three.js
- **Dexie.js (IndexedDB)** para persistência local na Fase 1
- **Supabase** (Auth, Postgres + RLS, Edge Functions, pg_cron, Realtime) somente a partir da Fase 2
- Zustand para estado de UI. Vitest para testes. Sem CSS-in-JS: CSS Modules ou Tailwind, escolher um e não misturar

## Estrutura

```
idle-strike-2/
├── CLAUDE.md
├── docs/GDD.md
├── packages/engine/        # simulação determinística (ver regras abaixo)
│   ├── src/
│   │   ├── rng.ts          # PRNG com seed (mulberry32 ou xoshiro)
│   │   ├── data/           # armas, mapas, cartas, classes — JSON/TS puro
│   │   ├── player.ts       # atributos, classe, build efetiva
│   │   ├── economy.ts      # dinheiro, compra, loss bonus
│   │   ├── round.ts        # fluxo de um round
│   │   ├── match.ts        # fluxo de uma partida
│   │   ├── duel.ts         # resolução de duelo
│   │   ├── rating.ts       # rating individual, MMR
│   │   ├── events.ts       # tipos do log de eventos
│   │   └── index.ts
│   └── test/
└── apps/web/
    ├── src/
    │   ├── screens/        # lobby, perfil, treino, partida, inventário
    │   ├── match/          # player do replay: radar (canvas), kill feed, scoreboard
    │   ├── minigames/      # cada minigame é um módulo canvas isolado
    │   ├── store/          # zustand + dexie
    │   └── ui/             # design system (tokens FACEIT-like)
    └── public/
```

## Regras do motor — inegociáveis

1. **Determinismo total.** Mesmo `seed + inputs` = mesmo log de eventos, byte a byte. Proibido `Math.random`, `Date`, `performance.now`, ou qualquer estado global dentro do engine. Todo aleatório passa pelo `Rng` injetado.
2. **O motor produz um log de eventos, não uma UI.** A partida é decidida inteira em uma chamada (`simulateMatch(config, seed) → MatchLog`). O app só *reproduz* o log no tempo que quiser (normal, 2x, pular). Nunca o contrário.
3. **Zero dependência de ambiente.** Nada de `window`, `document`, `fetch`, `localStorage` no engine. Se precisar de dado, entra por parâmetro.
4. **Resultado do minigame nunca entra no motor.** Minigame → recompensa. Ponto.
5. **Balanceamento por simulação em massa.** Toda mudança em fórmula precisa passar por `test/balance.test.ts`, que roda milhares de partidas e checa faixas (favorito ganha ~62–68%, pistol round pesa, eco ganha 12–20%, rating médio ≈ 1.00). Se a faixa quebrar, o teste quebra.
6. Dados de jogo (armas, cartas, mapas) são **tabelas em `data/`**, nunca hardcoded em lógica.

## Regras do app

- **Safari (macOS/iOS) e Chrome mobile são alvos de primeira classe.** Testar neles antes de considerar pronto. Nada que dependa de API que o Safari não tem.
- Mobile-first no layout da partida: radar + kill feed + scoreboard têm que caber em tela vertical.
- Radar e minigames em Canvas 2D com `requestAnimationFrame`, pausáveis, e que sobrevivem a `visibilitychange` (usuário trocou de aba).
- Persistência: tudo em Dexie na Fase 1. Schema versionado desde o primeiro dia (`db.version(n)`), porque vai migrar pro Supabase.
- Sem login na Fase 1.

## Propriedade intelectual — regras duras

- **Nenhum asset da Valve/CS**: sem ícones de arma do jogo, sem radar dos mapas reais, sem nomes de mapa, sem fontes/skins/sons do CS. Tudo é desenhado do zero.
- Mapas são **paródias**: layout *inspirado* (dois sites, mid, rotações), nome próprio, radar próprio.
- Orgs, jogadores e patrocinadores fictícios.
- Nomes de armas reais (AK-47, M4, AWP) são nomes de armas reais, não da Valve — podem ser usados. Ícones são nossos.
- Skins são cosméticos originais. Nada de reproduzir skins existentes.

## Como trabalhar

- Fase 1 é **100% local**. Não criar nada de Supabase até o loop local prender por uma tarde de jogo.
- Antes de codar uma feature, checar a seção correspondente no `docs/GDD.md`. Se a feature não está no GDD, perguntar antes de inventar.
- Números de balanceamento do GDD são **ponto de partida**, não verdade. Mudar via teste de balance, e atualizar o GDD quando mudar.
- Commits pequenos. Uma feature = um PR/commit com teste.
- Português nos textos de UI. Código e comentários em inglês.

## Roadmap resumido

| Fase | Entrega | Servidor |
|---|---|---|
| 1 | Loop local: boneco → treino/DM → queue solo vs bots → tela HLTV + 1 minigame → cartas/build → drops | não |
| 2 | Supabase: auth, online assíncrono, patente/MMR, ranking de rating, passivos | sim |
| 3 | Mais mapas, mais minigames, coleção/craft, temporadas, orgs/contratos | sim |
| 4 | Lobby ao vivo com amigos, campeonatos | sim |

Ordem de construção da Fase 1: **engine → teste de balance → radar/replay → tela HLTV → minigame → progressão/cartas → treino/DM → drops/inventário**. Nada de UI de lobby bonita antes do motor rodar.
