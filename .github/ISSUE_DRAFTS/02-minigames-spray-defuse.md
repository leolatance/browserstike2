---
title: "Minigames: spray e defuse"
labels: [minigame, design]
---
**GDD:** 10 (Minigames) — **não está no GDD**; proposta de design.

## Ideia
- **Spray**: quando o boneco entra num duelo com rifle a curta/média distância, um padrão de recuo aparece; o jogador arrasta compensando. Score pela distância média ao padrão.
- **Defuse**: no evento `defuseStart`, uma barra de 5 s/10 s com um toque no momento certo (parecido com a variante *timing* do alvo).

Como as variantes atuais (timing / pré-mira / flashado / alvo), tudo no mesmo canvas e toggle; só recompensa.

## Pronto quando
- Regras e pontuação fechadas aqui e no GDD 10.
- Cada minigame é um módulo isolado em `apps/web/src/minigames/`, ligado por evento do log (`duel` com arma/distância, `defuseStart`).
- Sem mudança no engine.
