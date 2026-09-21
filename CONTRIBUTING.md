# Contribuindo

## Antes de codar

- **Bug ou ajuste pequeno**: abre o PR direto.
- **Feature nova**: abre uma issue antes, citando o item do `docs/GDD.md` que ela toca (ex.: "GDD 6.4 — conjuntos"). Se a feature não está no GDD, a issue é a proposta de design; código só depois de combinado. O GDD é o cânone do jogo; o `CLAUDE.md` são as regras de engenharia.

## Fluxo de PR

1. Branch a partir de `main` (`feat/…`, `fix/…`).
2. Um assunto por PR, commits pequenos. Texto de UI em português, código e comentários em inglês.
3. Rode os testes (abaixo). PR que quebra um gate do balance não entra, mesmo que "melhore" outra coisa: recalibre e atualize o GDD no mesmo PR.
4. Marque o checkbox do CLA no template. O CI confere.

## Testes

| Comando | O que roda | Quando |
|---|---|---|
| `npm run typecheck` | TypeScript nos dois pacotes | sempre |
| `npm run test:fast` | engine sem o balance + testes do app web | sempre (é o CI do PR) |
| `npm run test:balance:quick -w @idle-strike/engine` | balance com 1.500 partidas/cenário (~1 min) | smoke local; os gates são calibrados pra 5.000, pode oscilar |
| `npm run test:balance` | balance completo, 5.000 partidas/cenário + gates de cartas (~3–4 min) | mexeu em fórmula, carta, arma, mapa, bot |
| `npm run test:deno` | testes das edge functions (precisa de Deno; `npx deno` usa o `deno-bin`) | mexeu em `supabase/functions` |
| `npm test` | tudo do engine (com balance) + web | antes de pedir review |

Mexeu no engine e nas functions? Rode `scripts/bundle-engine.sh` pra regenerar `supabase/functions/_shared/engine.js` e commite junto.

## Regras do motor (resumo do CLAUDE.md)

- Determinismo total: mesmo `seed + inputs` = mesmo log. Nada de `Math.random`, `Date`, `performance.now` dentro de `packages/engine`.
- O motor produz um log de eventos; a UI só reproduz. Resultado de minigame nunca entra no motor.
- Dados de jogo (armas, cartas, mapas) são tabelas em `data/`, nunca hardcoded em lógica.

## Propriedade intelectual — regras duras

- **Nenhum asset da Valve/CS**: sem ícones de arma do jogo, sem radar dos mapas reais, sem nomes de mapa, sem fontes/skins/sons do CS. Tudo é desenhado do zero.
- Mapas são **paródias**: layout *inspirado* (dois sites, mid, rotações), nome próprio, radar próprio.
- Orgs, jogadores e patrocinadores fictícios.
- Nomes de armas reais (AK-47, M4, AWP) são nomes de armas reais, não da Valve — podem ser usados. Ícones são nossos.
- Skins são cosméticos originais. Nada de reproduzir skins existentes.

PR com asset de origem duvidosa é fechado sem discussão.

## Alvos de plataforma

Safari (macOS/iOS) e Chrome mobile são alvos de primeira classe. Layout da partida é mobile-first. Testa neles antes de marcar como pronto.
