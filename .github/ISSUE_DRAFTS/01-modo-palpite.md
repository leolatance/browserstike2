---
title: "Minigame: modo palpite (previsão)"
labels: [minigame, design, good-first-issue]
---
**GDD:** 10 (Minigames) — **não está no GDD**; esta issue é a proposta de design. Entra em 10.x se aprovada.

## Ideia
Em vez de tocar no alvo, o jogador **palpita** antes do duelo: "meu boneco ganha" / "perde" (ou quem ganha o round, no freezetime). Acertos viram score do minigame como hoje (só recompensa, nunca entra no motor — regra 4 do CLAUDE.md).

## Por que
Dá pra jogar com uma mão, no ônibus, sem reflexo. Complementa o alvo (reflexo) com leitura de jogo.

## Pronto quando
- Proposta de regra fechada aqui (janela de palpite, pontuação, o que mostra na tela).
- Seção no GDD 10.
- Implementado como módulo em `apps/web/src/minigames/`, toggle no mesmo lugar do alvo, sem tocar em `packages/engine`.
