# Idle Strike 2 — Game Design Document

Versão 0.4 — 20/09/2026. Documento vivo. Números marcados com `[v0]` são valores iniciais de balanceamento e devem ser ajustados via simulação em massa. Números marcados com `[v1]` já passaram pelo `test/balance.test.ts` (5.000 partidas por cenário) e são os que estão no código.

---

## 1. Visão

**Tese:** CS pra quem não pode abrir o CS agora. Mac, celular, trabalho, ônibus, PC quebrado.

**Fantasia:** você é um jogador de CS. Cria seu boneco no nível 0, treina, joga 5x5, evolui atributos, monta build de cartas, sobe patente, sobe no ranking de rating, coleciona skins. A meta é ser o melhor jogador de CS do jogo.

**Pilares**
1. **Respeito ao CS.** Economia real, roles reais, rating estilo HLTV, patente. O jogador conhece o jogo — nada pode soar errado pra ele.
2. **Sim assistível.** A partida é simulada, mas *assistir* tem que ser bom: tela HLTV Live com radar, kill feed, scoreboard, economia, drama de round.
3. **Progressão de boneco com build.** Barras (base) + cartas (perks) + classes que misturam. A comunidade discute meta de build.
4. **Idle honesto.** O jogo anda sem você (bonecos passivos jogam online), mas presença rende mais. Nunca "número sobe sozinho".
5. **Cosmético com palco.** Skins aparecem no kill feed, scoreboard, perfil. Só cosmético é vendido.

**Referências de UI:** FACEIT (lobby, perfil, ladder), HLTV Live (tela de partida). Escuro, denso, informativo. Sem cartoon.

**Não é:** manager de org (descartado por enquanto), jogo de reflexo, idle clicker.

---

## 2. Loop principal

```
criar boneco → box inicial
   ↓
treino / DM  ──→ barras de atributo sobem (base, lento, cap por lvl)
   ↓
queue 5x5 solo (bots)  ──→ XP, box de cartas, cosmético   [não sobe barra]
   ↓
queue 5x5 online        ──→ XP↑, drops↑, patente (MMR), rating (ranking)
   ↓
inventário: cartas → build, cosméticos → equipar/coleção
   ↓ (volta)
```

**Sessão típica:** 1 treino (3 min) + 1–2 partidas (6–8 min cada) + abrir box + mexer na build. 15–25 min.

**Meta de longo prazo:** rating no topo do ranking → orgs de paródia oferecem contrato (Fase 3).

---

## 3. O boneco

### 3.1 Identidade
- Nick, foto de perfil, país/bandeira, mão (cosmético). `[v1]` **Foto**: upload no onboarding e no perfil, redimensionada a 256×256 (JPEG ~0,8) e guardada como blob no Dexie; sem foto, iniciais do nick sobre uma cor sólida derivada do nick. Não há mais avatares pré-desenhados.
- `[v1]` **Cor do jogador** (regra do CS): 5 cores fixas — amarelo, roxo, verde, azul, laranja (tokens `--p-*`, valores próprios) — escolhida no perfil, padrão pela seed do nick, salva em `character.color`. No solo nunca há colisão; na Fase 2, dois iguais no mesmo time → um randomiza entre as restantes.
- Nível (XP) — 0 a 50 `[v0]`. Desbloqueia slots de carta, modos, caps de atributo.
- Patente — MMR online, faixas estilo CS/FACEIT (10 níveis `[v0]`). Reseta por temporada.
- Rating de carreira — acumula. Rating recente (últimos 10 jogos) define **forma**.

### 3.2 Atributos (0–100)
| Atributo | O que faz no sim |
|---|---|
| **Mira** | chance de vencer duelo, chance de HS, multi-kill |
| **Movimentação** | sobreviver a duelo perdido (recuar), chegar primeiro em posição, esquiva em rush |
| **Peek** | vantagem quando *inicia* o duelo (entry, refrag), timing |
| **Tático** | qualidade das calls (se IGL), escolha de posição, save/força correto, sobrevivência em rotação |
| **Utilitária** | efetividade de flash/smoke/molotov: reduz mira/peek do inimigo no duelo, abre site |
| **Mental** | clutch, resistência a tilt; oscila durante a partida (ver 5.6) |

Cap por nível `[v0]`: `cap = 40 + lvl × 1.2` (lvl 0 → 40, lvl 50 → 100).

### 3.3 Classes
Classe **não é atributo**: é *como o sim usa o boneco* — em quais duelos ele entra, em qual ordem, com qual arma. Classe vem das cartas equipadas (bônus de conjunto, ver 6.3). Sem conjunto ativo, o boneco é **Rifler**.

| Classe | Comportamento no sim | Atributo-chave |
|---|---|---|
| **Entry Fragger** | primeiro duelo do round no ataque; alta exposição | Peek, Mira |
| **IGL** | define a estratégia do round pro time; poucos duelos; call quality | Tático |
| **AWPer** | compra AWP quando o dinheiro permite; duelos de longa distância; pouca exposição | Mira, Movimentação |
| **Âncora** | segura o site na defesa; raramente duela no meio do round; alta sobrevivência; retake fraco | Tático, Mental |
| **Rifler** | padrão; duelos de meio; segundo contato | equilibrado |
| **Support** | joga utilitária pro time; buffa o Entry; poucos kills, muitos assists | Utilitária |
| **Star Player** | wildcard: pega o duelo mais favorável disponível no round; ignora role do time | Mira, Mental |

Um time precisa de composição: sem IGL, `Tático` efetivo do time cai `[v0: −15%]`. Dois AWPers = só um compra.

### 3.4 Build efetiva
`atributo_efetivo = base (barra) + Σ bônus planos das cartas + modificadores situacionais (cartas condicionais, forma, utilitária inimiga)`. `[v1]` **Sem clamp superior no duelo**: o teto 0–100 vale para a barra base (cap por nível) e para a exibição; cartas podem levar o atributo efetivo acima de 100 dentro do sim. Só o piso 0 é aplicado. Motivo: com o clamp, a terceira carta de um mesmo atributo era desperdício e o gate de 6 slots não fechava.

---

## 4. Modos de jogo

| Modo | Sobe barra | XP | Drop | Patente/Rating | Server |
|---|---|---|---|---|---|
| **Treino** | sim (forte) | baixo | cosmético raro | não | não |
| **Deathmatch** | sim (Mira, Peek, Movimentação) | baixo | cosmético raro | não | não |
| **Queue 5x5 solo** | **não** | médio | box de cartas | não | não |
| **Queue 5x5 online** | **não** | alto | box de cartas↑ + cosmético | sim | sim (Fase 2) |

### 4.1 Treino
Sessão de ~3 min. Jogador escolhe 1 atributo foco (não Mental). Minigame correspondente opcional (ex.: Mira → alvos; Utilitária → lineup de smoke, acertar o ponto). Ganho de barra `[v0]`:
- Base: `+0.8` no atributo foco, `+0.2` num secundário aleatório.
- Minigame: multiplica por 1.0 (não jogou) até 1.5 (perfect).
- **Rendimento decrescente diário:** sessões 1–3 do dia rendem 100%, 4–6 rendem 40%, 7+ rendem 10%. Reset às 00:00 local. Sem "energia" visível — mostra apenas "rendimento: alto / médio / baixo".
- Ganho é reduzido conforme se aproxima do cap: `ganho × (1 − (atual/cap)^2)`.

### 4.2 Deathmatch
Sessão de ~4 min, minigame de mira mais intenso, ganho espalhado em Mira/Peek/Movimentação. Mesma regra de rendimento decrescente (compartilhada com Treino). Serve como o "treino rápido".

### 4.3 Queue 5x5 solo
Partida completa contra 9 bots nivelados. Nivelamento: bots recebem atributos `≈ média do jogador ± 8` `[v0]`, com classes distribuídas (1 IGL, 1 AWPer, 1 Entry, 2 Rifler/Âncora). Dificuldade não tem seletor — vem do nível/atributos.

Recompensa (ver 8) — XP e box de cartas. **Não sobe barra.**

### 4.4 Queue 5x5 online (Fase 2)
**Assíncrono.** Ao entrar na queue, o servidor monta o 5x5 com **bonecos de jogadores reais** de MMR próximo (presentes ou não), completa com bots nivelados se faltar, simula com seed, grava. O cliente reproduz o log.

- Boneco **presente** (dono na partida): MMR e rating cheios, recompensa cheia.
- Boneco **passivo** (recrutado sem o dono online): joga com atributos e build reais; rating conta com peso 0.5; MMR não muda; dono recebe XP pequeno e notificação ("seu boneco jogou 3 partidas: 1.14 de rating").
- Bot: não gera nada pra ninguém.

Lobby ao vivo com amigos = Fase 4.

---

## 5. Motor de simulação

### 5.1 Princípios
- Determinístico por seed. `simulateMatch(config, seed) → MatchLog`.
- MR12 (primeiro a 13, overtime MR3 em 12–12) `[v0]`. Mapa fixo por partida.
- A partida é resolvida inteira de uma vez; o app reproduz o log.
- Toda decisão passa por atributos + Rng. Nenhum "script".

### 5.2 Entidades
```ts
Player { id, nick, attrs: {mira, mov, peek, tatico, util, mental}, class, build, cosmetics, team: 'CT'|'T', money, alive, weapon, armor, utils[] }
Team   { id, players[5], score, money[], lossStreak, igl?: Player }
Map    { id, name, sites: ['A','B'], areas[], routes[], radar: {w,h,...} }
MatchConfig { map, teams[2], mr: 12, seedPlayers?: boolean }
```

### 5.3 Fluxo do round
1. **Compra** — cada jogador decide por dinheiro do time + classe + IGL (5.4).
2. **Call** — IGL do T escolhe estratégia: `rush A | rush B | split A | split B | default | fake`. IGL do CT escolhe setup: `padrão | stack A | stack B | agressivo`. Qualidade da call = `Tático` do IGL (sem IGL: random com viés ruim).
3. **Fase inicial (0–40s)** — contatos iniciais: Entries e agressivos do CT geram 0–2 duelos de "mapa" (mid, abertura).
4. **Execução (40–75s)** — T entra no site escolhido. Duelos sequenciais conforme classes: Entry → Rifler → Star; defesa: Âncora e Rifler do site, Support joga util (reduz atributos dos atacantes).
5. **Plant / Pós-plant** — se T dominou o site, planta (Support ou Rifler). CT rotaciona (chegada depende de `Movimentação` + `Tático`) e faz retake: duelos com bônus de posição pro T.
6. **Fim** — bomba explode / defuse / eliminação / tempo (1:55). Dinheiro atualizado.
7. **Clutch** — se resta 1 vs N, cada duelo usa `Mental` como modificador principal (5.6).

Cada duelo gera eventos: `kill {attacker, victim, weapon, headshot, wallbang?, throughSmoke?}`, `assist`, `flashAssist`, `damage`, `plant`, `defuse`, `move {player, from, to}`. O radar é reproduzido a partir dos eventos `move` + timing.

### 5.4 Economia `[v0]` (valores do CS)
- Início de lado: $800. Pistol round.
- Vitória: $3250 por eliminação ou tempo; $3500 por bomba explodida ou defuse. `[v1]` Eliminar os CTs depois do plant paga $3250 (é eliminação), não $3500.
- Derrota: loss bonus $1400 → $1900 → $2400 → $2900 → $3400. Plant perdida: +$800.
- `[v1]` Regra do CS2: vencer um round **decrementa** o loss streak em 1 (não zera). O streak zera na troca de lado.
- `[v1]` T vivo quando o tempo acaba sem plant recebe **$0** de loss bonus (não tentou).
- `[v1]` Overtime MR3: $10.000 no início de cada half de OT, inventário zerado, lados trocam a cada 3 rounds; o primeiro half de OT mantém os lados do 2º tempo.
- Kill reward por arma: rifle $300, AWP $100, SMG $600, shotgun $900, faca $1500.
- Preços: AK $2700, M4 $2900/$3100, AWP $4750, Galil/FAMAS $1800/$2050, MP9/MAC-10 $1250/$1050, Deagle $700, P250 $300, kevlar $650, kevlar+capacete $1000, kit $400, flash $200, smoke $300, molotov $400/$600, HE $300.
- **Decisão de compra do time** (IGL ou média do Tático): `full buy` se todos podem comprar rifle+armor (piso: rifle mais barato + kevlar; rifle salvo conta); `force` se média ≥ $2000 e loss streak ≥ 2; `eco` caso contrário. `Tático` baixo erra essa decisão com probabilidade `(100 − tatico)/200`. `[v1]` O erro cai na opção **vizinha** (`full ↔ force ↔ eco`): ninguém com $4000 cada "erra" pra eco.
- Individual: AWPer compra AWP se ≥ $5750 (só um por time); Rifler compra o melhor rifle que cabe deixando $1000 de reserva (se nem o mais barato cabe com reserva, compra o que cabe); Support prioriza util.
- `[v1]` Em `eco`: save total abaixo de $1500 (perdedor de pistol); P250 com 60% a partir de $1500; Deagle com 50% a partir de $2400. Rifle salvo nunca é trocado.
- `[v1]` CT em `eco` stacka **4 num site** em 80% dos rounds (o 5º fica no meio). Stack de eco não é legível pelo IGL T antes do contato: o T escolhe o site no cara-ou-coroa.
- `[v1]` Sobrevivente mantém arma, armor e kit; utilitária não usada é descartada no fim do round. Quem mata pode pegar a arma da vítima se for melhor (70%).

Armas afetam duelo: `AWP` +18 em longa / +4 em média / −10 em curta; `rifle` 0 (Galil/FAMAS −2/−2/−3); `SMG` +6 em curta / −6 em média e longa; `pistola` **−15** `[v1: era −18]` (P250 −12/−13/−15, Deagle −10/−9/−9 por curta/média/longa); sem armor **−5** no score do duelo `[v1: era −8]`. Motivo: com −18/−8 o eco vencia ~10% (meta 12–20%).

### 5.5 Resolução de duelo `[v0]`
Para atacante **A** (quem inicia) e defensor **D**:

```
scoreA = k·(0.45·mira + 0.25·peek + 0.15·mov + 0.15·util) + arma + situação
scoreD = k·(0.45·mira + 0.25·tatico(posição) + 0.15·mov + 0.15·util) + arma + situação
k = 0.14   [v1: era 1.0 implícito]

situação: defensor segurando ângulo +10 [v1: era +6]; atacante flashado −15·(util_inimiga/100);
          duelo em smoke −10 ambos; retake pró-T +5; 2v1 numérico +8 pro lado com vantagem;
          sem armor −5; HP faltando −0.08 por ponto

P(A vence) = 1 / (1 + 10^((scoreD − scoreA) / 40))
P(headshot | vitória) = 0.25 + 0.5·(mira_vencedor/100)
P(perdedor sobrevive recuando) = 0.05 + 0.25·(mov_perdedor/100)   → gera 'damage' em vez de 'kill'
P(trade em 3s) = 0.2 + 0.2·(peek do próximo aliado/100)   [v1: era 0.3 + 0.4·peek]
P(perdedor acerta dano parcial) = 0.20, 10–60 de dano   [v1: alimenta assist e ADR]
```

`[v1]` **Por que k = 0.14.** Com a fórmula literal (k = 1) um time +10 em tudo vencia 99% das partidas: o duelo compõe ~150 vezes por partida e a economia amplifica. Os atributos ainda entram fora da fórmula (flash por Util, trade por Peek, decisões por Tático, recuo por Mov, Mental) e só esses canais já dão ~60% pro time +10; k = 0.14 leva à faixa 70–76%. Consequência no duelo isolado, tudo o mais igual: **Mira 100 vs Mira 0 = 59%** de vitória; **todos os atributos 100 vs 0 = 69%**. A vantagem de atributo é suave por duelo e decisiva por partida, como no CS real.

`[v1]` **Interpretações de regra fixadas no código:**
- "2v1 numérico" usa a contagem de **vivos do time no round** (5v4, 3v1…), não quem está presente no confronto local. Senão todo hit 5v2 nascia com +8 pro T.
- No pós-plant o T defende **sem** o bônus de ângulo: recebe só o +5 de retake. Os CTs se reagrupam antes do retake (esperam todos chegarem ou até 20s antes da bomba).
- Trade: a P(trade) do GDD antigo (~50% a Peek 50) dobrava kills; CS real gira em ~30%. A inclinação por Peek também era o 2º maior canal escondido de vantagem de atributo.
- Duelos são distribuídos por round-robin dentro do time (quem lutou menos no round peeka primeiro, desempate por classe). Sem isso o Entry encadeava 4 kills ou morria e a distribuição de multi-kills ficava irreal.

Distâncias do mapa: cada rota/área tem `range: 'short'|'mid'|'long'` que aplica o modificador de arma.

### 5.6 Mental e forma
- `Mental` efetivo começa a partida em `base × forma`, onde forma = `clamp(0.85, 1.15, rating_recente)`.
- Durante a partida: perder round −2, perder 3 seguidos −5 extra, ganhar clutch +6, sofrer ace −4, vencer pistol +3. Clamp 0–100.
- `Mental` entra em: clutch (substitui `tatico` no scoreD e soma 0.2·mental ao score), decisão de save/força, e como multiplicador leve em todos os atributos: `× (0.9 + 0.2·mental/100)`.

### 5.7 Bots
Mesma estrutura de `Player`. Atributos gerados por nível alvo, classes distribuídas. Nomes de paródia gerados (lista em `data/botnames.ts`).

### 5.8 Testes de balance (obrigatórios)
Rodar 5.000 partidas por cenário (`packages/engine/test/balance.test.ts`; relatório rápido com `npm run balance:report -- 1000`):
- Times iguais → 50% ± 3.
- Time +10 em todos os atributos → **70–76%** `[v1: era 62–68%]`.
- Pistol round: vencedor do pistol vence o round 2 em ≥ 75%.
- Eco vs full buy → 12–20%. `[v1]` Cenário: time em `eco` com $2.400 cada vs time em `full` com $10.000, round isolado, lados alternados.
- Rating médio de todos os jogadores ≈ 1.00 ± 0.03; desvio padrão **0.25–0.35** `[v1: era 0.15–0.25]`. Com os coeficientes públicos do HLTV 2.0 a dispersão natural por partida é ~0.31 (a distribuição de multi-kills bate com o CS real: 2k 10%, 3k 2,6%, 4k 0,6%); a faixa antiga exigiria comprimir a escala.
- Distribuição de placares: 13–0 a 13–2 < 6% em times iguais.
- Duração média 22–26 rounds.

- `[v1]` **Cartas** (gates por rating do boneco, seeds pareadas: a mesma partida com e sem build, n = 1.000; boneco lvl 0 vs bots nivelados sem cartas):
  - melhor build de 2 slots no nível I → rating do boneco **+0,08 a +0,15**;
  - 6 melhores cartas no nível III → **+0,30 a +0,45**.
  A vitória do time continua no relatório como diagnóstico, não como gate. Se sair da faixa, ajustar os números das cartas em `data/cards.ts`, nunca os coeficientes de duelo. A "melhor build" é encontrada pelo próprio teste (ranking individual em dois estágios e seleção progressiva por combinação).

Resultado v1 cartas (20/09/2026): melhor dupla lvl I = Counter-strafe + Jiggle peek, rating **+0,094** (vitória 57,6% vs 49,2%); seis lvl III = Counter-strafe, Tap firing, Crosshair placement, Jiggle peek, Lineups, Timing de util, rating **+0,370** (vitória 72,4% vs 47,8%).

Resultado v1 (19/09/2026): iguais 49,5% · +10 73,6% · pistol 77,6% · eco 17,6% · rating 1,000 / 0,312 · blowouts 2,5% · 22,38 rounds. Diagnóstico fora dos gates: CT vence ~50% dos rounds, plant em ~48%, fins por eliminação 57% / bomba 24% / tempo 13% / defuse 5%.

---

## 6. Cartas e build

`[v1]` Implementado em `packages/engine/src/data/cards.ts` (dados) e `player.ts` (`resolveBuild`). Bots não usam cartas na Fase 1.

### 6.1 Tipos
- **Plana**: +N num atributo. 13 cartas.
- **Condicional**: +N num atributo quando a `situation` do duelo bate (segurando ângulo, flashado, clutch, trade, distância, retake, pós-plant, pistol, vantagem/desvantagem numérica, primeiro duelo do round, defendendo o site). 13 cartas.
- **Comportamental**: muda o que o sim faz. 4 cartas: Scout no round 2, salvar em 1v3+, AWP −$500, kit sempre.
- **Tag de classe** é independente do tipo: 21 das 30 cartas carregam tag, **3 por classe** (7 classes). Com 2 por classe um conjunto de 3 seria impossível, porque duplicata sobe nível em vez de virar segunda cópia.

### 6.2 Raridade, drop e níveis
| Tier | Nome | Drop | Cartas | Pó por cópia extra |
|---|---|---|---|---|
| 1 | Comum | 60% | 11 | 10 |
| 2 | Incomum | 25% | 10 | 25 |
| 3 | Rara | 10% | 5 | 60 |
| 4 | Épica | 4% | 2 | 150 |
| 5 | Lendária | 1% | 2 | 400 |

Duplicata → nível da carta (I → II → III). O número escala **×1 / ×1,25 / ×1,5** (a razão +4 → +5 → +6 do v0). Cópia além do III vira **pó** (sem craft ainda).

**Números** `[v1]`: ~4,5× os exemplos do v0 (+4 virou +18). Com `k = 0,14` na fórmula de duelo um ponto de atributo vale ~0,06 de score, e um único boneco precisa mover o próprio rating numa 5x5; +4/+8 eram cosméticos (melhor dupla: +0,048 de rating; seis cartas III: +0,17). Movimentação vale mais por ponto que Mira porque sobreviver ao recuo pesa em rating.

### 6.3 A tabela (30)
| id | nome | raridade | tipo | tag | I / II / III | efeito (nível I) |
|---|---|---|---|---|---|---|
| `card_aim_crosshair` | Crosshair placement | Comum | plana | Rifler | +18 / +22 / +27 | +18 Mira |
| `card_aim_spray` | Controle de spray | Incomum | plana | Rifler | +18 / +22 / +27 | +18 Mira |
| `card_aim_tap` | Tap firing | Épica | plana | Star | +22 / +28 / +33 | +22 Mira |
| `card_move_strafe` | Counter-strafe | Comum | plana | AWPer | +20 / +25 / +30 | +20 Movimentação |
| `card_move_jiggle` | Jiggle peek | Comum | plana | Entry | +20 / +25 / +30 | +20 Movimentação |
| `card_peek_timing` | Timing de peek | Comum | plana | — | +18 / +22 / +27 | +18 Peek |
| `card_peek_wide` | Wide swing | Incomum | plana | Entry | +18 / +22 / +27 | +18 Peek |
| `card_tac_positioning` | Posicionamento | Comum | plana | Âncora | +18 / +22 / +27 | +18 Tático |
| `card_tac_reading` | Leitura de jogo | Incomum | plana | IGL | +18 / +22 / +27 | +18 Tático |
| `card_util_lineups` | Lineups | Comum | plana | Support | +18 / +22 / +27 | +18 Utilitária |
| `card_util_timing` | Timing de util | Incomum | plana | Support | +18 / +22 / +27 | +18 Utilitária |
| `card_mental_focus` | Foco | Comum | plana | Star | +18 / +22 / +27 | +18 Mental |
| `card_mental_calm` | Sangue frio | Incomum | plana | Âncora | +18 / +22 / +27 | +18 Mental |
| `card_cond_prefire` | Pré-mira de esquina | Rara | condicional | — | +36 / +45 / +54 | +36 Mira quando defende segurando ângulo |
| `card_cond_first_contact` | Primeiro contato | Rara | condicional | Entry | +36 / +45 / +54 | +36 Peek no primeiro duelo do round atacando |
| `card_cond_flash_eyes` | Olhos fechados | Incomum | condicional | Support | +36 / +45 / +54 | +36 Mira quando flashado |
| `card_cond_clutch_nerves` | Nervos de aço | Lendária | condicional | — | +45 / +56 / +68 | +45 Mental em clutch |
| `card_cond_trade_instinct` | Instinto de trade | Incomum | condicional | — | +36 / +45 / +54 | +36 Peek ao tradar um aliado |
| `card_cond_long_range` | Olho de águia | Incomum | condicional | AWPer | +27 / +34 / +40 | +27 Mira em longa distância |
| `card_cond_short_range` | Cão de briga | Comum | condicional | Rifler | +27 / +34 / +40 | +27 Mira em curta distância |
| `card_cond_retake_calm` | Retake frio | Rara | condicional | IGL | +36 / +45 / +54 | +36 Tático em retake |
| `card_cond_postplant` | Pós-plant | Incomum | condicional | — | +36 / +45 / +54 | +36 Tático defendendo a bomba plantada |
| `card_cond_pistol_hero` | Herói do pistol | Comum | condicional | — | +36 / +45 / +54 | +36 Mira no pistol round |
| `card_cond_numbers_down` | Contra a maré | Rara | condicional | — | +45 / +56 / +68 | +45 Mental em desvantagem numérica |
| `card_cond_site_anchor` | Dono do site | Épica | condicional | Âncora | +36 / +45 / +54 | +36 Tático defendendo o site |
| `card_cond_star_pick` | Escolha do craque | Lendária | condicional | Star | +45 / +56 / +68 | +45 Mira em vantagem numérica |
| `card_beh_scout` | Scout no pistol | Incomum | comportamental | AWPer | — | Compra Scout no round 2 se tiver dinheiro |
| `card_beh_save` | Salva a arma | Comum | comportamental | — | — | Em 1v3 ou pior, recua e salva em vez de duelar |
| `card_beh_awp_discount` | Desconto na AWP | Rara | comportamental | — | — | AWP custa −$500 |
| `card_beh_kit` | Kit sempre | Comum | comportamental | IGL | — | Como CT, compra kit antes de tudo |

### 6.4 Slots e conjuntos
- Slots por nível: lvl 0 → 2, lvl 5 → 3, lvl 12 → 4, lvl 20 → 5, lvl 35 → 6.
- **Conjunto**: 3 cartas distintas com a mesma tag ativam a classe e o bônus. Dois conjuntos = híbrido: a primeira tag equipada é a classe que o sim joga, os dois bônus valem.
- Sem conjunto → Rifler.

Bônus de conjunto `[v1]` (como está no código):
| Classe | Bônus |
|---|---|
| Entry | +10 Peek no primeiro duelo do round atacando; trade garantido em 3s se morrer |
| IGL | time ganha +8 Tático nas decisões de compra e call |
| AWPer | AWP custa −$500; +6 Mira em longa |
| Âncora | +12% de chance de escapar defendendo o site; +$200 por round sobrevivido |
| Support | util do time ×1,15 no cálculo da flash; flash assist sempre creditado |
| Star | +6 de score no primeiro duelo do round (a "escolha do duelo favorável") |

### 6.5 Boxes
- **Box inicial** (onboarding): 5 comuns — 2 planas, 1 condicional, 2 com tag de classe. Rolada pela seed do nick.
- **Box de partida** (queue solo): **2 cartas** por partida, tier pela tabela acima, rolada pela seed da partida. Com 2 cartas o primeiro conjunto de 3 fecha em média em **9 partidas** (p50 9, p75 12, p90 16); com 3 cartas cairia para 6.
- O log da partida conta quantas vezes cada carta/conjunto disparou (`PlayerStats.cardTriggers`), e a tela de resultado mostra.

## 7. Cosméticos

`[v1]` Só skins precisam de arte gerada; foto de perfil, cores de jogador, ícones de arma (silhuetas), molduras de carta e radar são código.

- Categorias: skin de arma (por arma), luvas, agente (retrato), fundo de perfil, badge, kill feed style, card back.
- Raridade mesma escala. Duplicata → pó → craft (Fase 3).
- **Palco**: skin equipada aparece no kill feed (`nick [AK | skin]`), no scoreboard (ícone), no perfil (showcase até 6 itens).
- Todos originais. Nada baseado em skins existentes do CS.
- Monetização (Fase 3): box de cosmético e skins específicas. **Nunca cartas por dinheiro.**

---

## 8. Recompensas e progressão

### 8.1 Recompensa de partida
```
XP = base(60) × resultado(1.0 vitória / 0.6 derrota) × desempenho(0.6 + 0.8·clamp(rating, 0.5, 1.5) − 0.4) × minigame(1.0–1.3) × modo(solo 1.0 / online 1.6)
```
Um 1.60 na derrota rende mais que um 0.80 na vitória — por design.

- Box de cartas: 1 por partida solo, 1 + chance de extra online. Raridade rola tier a tier.
- Cosmético: 8% solo, 15% online `[v0]`.
- Minigame: perfect (top 10% do próprio histórico) → baú extra pequeno.

### 8.2 Rating individual (estilo HLTV 2.0)
Aproximação pública, mantida em `[v1]` (KAST em porcentagem 0–100):
```
Impact = 2.13·KPR + 0.42·APR − 0.41
Rating = 0.0073·KAST + 0.3591·KPR − 0.5329·DPR + 0.2372·Impact + 0.0032·ADR + 0.1587
```
`[v1]` Testou-se comprimir os termos por round (×0.75) pra caber a std em 0.15–0.25; revertido — a faixa é que estava errada (ver 5.8). Um 30-bomb continua valendo ~1.5.
Ajuste por role `[v0]`: Âncora +0.05 por round sobrevivido em defesa; Support conta flash assist como 0.5 kill no Impact; IGL soma +0.03 por round vencido em call correta.

Rating de carreira = média ponderada (últimas 50 partidas peso 2, resto peso 1). Forma = média das últimas 10.

### 8.3 Patente / MMR (Fase 2)
Elo com K=25 `[v0]`. Amortecimento por desempenho:
```
f = clamp((rating_partida − 1.0) × 0.8, −0.4, +0.4)
vitória: Δ = +K × (1 − E) × (1 + f)
derrota: Δ = −K × E × (1 − f)
```
Carry perde menos, carregado ganha menos.

### 8.4 Rankings
- **Patente**: ladder clássica, por temporada.
- **Rating**: ladder por faixa de patente (padrão) e global normalizado pelo nível dos adversários. Filtros: temporada, mapa, role. Badges "Top 100 rating" no perfil.

### 8.5 Temporada (Fase 2)
30 dias. Reseta patente (soft reset: MMR → média com o centro). Rating de carreira, nível, cartas, cosméticos permanecem. Recompensa de fim de temporada por patente final e por posição no ranking de rating.

---

## 9. Tela de partida (HLTV Live)

Layout mobile-first (vertical), reorganiza em desktop:

```
┌──────────────────────────────┐
│ CT 7 – 5 T   round 13  1:12  │  ← placar, timer, ícone C4 quando plantada
│ $ CT: 4.2k avg  T: 1.1k (eco)│  ← economia dos times
├──────────────────────────────┤
│         RADAR (canvas)       │  ← 10 pontos coloridos, direção, mortos = X,
│                              │     smoke/molotov = blobs, C4, sites A/B
├──────────────────────────────┤
│ KILL FEED                    │  ← "nick [ícone arma][HS] nick", skin aparece
├──────────────────────────────┤
│ MINIGAME (área fixa)         │  ← ou sobrepõe o radar no momento do duelo
├──────────────────────────────┤
│ SCOREBOARD (expansível)      │  ← K D A ADR Rating, seu boneco destacado
└──────────────────────────────┘
```

- `[v1]` **Radar em visão do jogador**: aliados nas 5 cores (o boneco na cor dele, bots nas 4 restantes) e inimigos todos em vermelho; mesma paleta no kill feed (nome) e no scoreboard (bolinha). O header mantém CT/T só como rótulo de lado. Toggle "visão: jogador | HLTV" (azul/laranja): padrão jogador na partida da queue e nos drills, HLTV no replay e em dev.
- Reprodução do log: normal (round ≈ 15–20s), 2x, pular pro fim. Pausa.
- Resultado já está decidido no início; a tela só desenrola.
- Eventos de round destacados: pistol, eco, force, clutch, ace, plant/defuse.
- Skins: a arma no kill feed usa o ícone da skin equipada.
- Fim de partida: tela de resultado com stats, rating da partida, recompensas, box pra abrir.

---

## 10. Minigames

Regra: **sincronizados ao sim, opcionais, só recompensa.** Score do minigame nunca altera o log.

### 10.1 Alvo de duelo (Fase 1)
Quando o boneco do jogador entra num duelo (evento `duel`, 0,8s antes da resolução), um alvo aparece no canvas do minigame por 900ms. Clicar/tocar rápido e centrado = score alto: `0,6·reação (150ms=100 → 900ms=0) + 0,4·distância do centro`. Score do minigame = média dos duelos "acompanhados". O kill feed mostra o resultado do sim normalmente. Perfect = todos os duelos com score ≥ 85. O alvo mostra a `situation` do duelo como rótulo (flashado, clutch 1vN, trade, segurando ângulo) sem alterar o score. `[v1]` Ritmo: o boneco do jogador recebe **20–30 duelos por partida** (medido: ~26 com classes de bot; Rifler ~30, Âncora ~25). Em 4x o minigame desliga.

### 10.2 Ritmo (Fase 3) — estilo osu
Sequência de alvos no ritmo da partida (eco = calmo, retake = intenso).

### 10.3 Boneco que atira (Fase 3) — estilo agar.io
Top-down mini-arena, controla um bonequinho, alvo = bots. Usado no Deathmatch.

### 10.4 Treino
`[v1]` Treino e DM são **simulação assistível** com a mesma regra da partida (log determinístico, minigame opcional que só altera o ganho). Motor em `packages/engine/src/drill.ts`.
- **DM** (3 min, tempo real): 5x5 com respawn de 3s, sem economia nem bomba; a barra sobe a cada kill do boneco (ganho da sessão dividido pelos kills do log). ~27 duelos do boneco por sessão (faixa 25–40).
- **Treino** (2 min): 5 cenários encadeados no radar com título e resultado ("venceu · 3/5 duelos · 20s"). Cadeias por foco: Mira 4× Aim 1v1 + Rush + Retake; Peek 3× Peek + Rush + Execute; Mov Peek/Rush/Aim/Peek/Retake; Tático 5 retakes com **call em 5s** (padrão/flanco/agressivo) contra um setup escondido, revelado no radar por 2s no fim; Util 4 executes com **lineup** (tocar o ponto do site em 1,5s) + Rush. A barra do foco sobe por cenário; o multiplicador (1,0–1,5) vem do alvo (Mira/Peek/Mov), das calls certas (Tático) ou da média dos lineups (Util). Sem interação = ×1,0.
- Duelos do boneco por sessão (boneco lvl 0): Mira 17,5 · Peek 17,5 · Mov 17,5 · Tático 6,2 · Util 6,4 (faixa desejada 15–25 para os focos com alvo).
- Rush/execute são drill de contato: sem plant.

---

## 11. Mapas

Paródias. Fase 1: **um mapa** — dois sites, mid, layout inspirado em mapa clássico de dois bombsites, nome próprio (a definir; não usar nomes reais). Radar desenhado do zero.

Estrutura de dados: `areas[]` (id, nome, polígono no radar, range), `routes[]` (de → para, tempo em s, range), `sites` (A/B com áreas de plant). Fase 3: mais 2–3 mapas.

---

## 12. Perfil (estilo página do HLTV)

Nick, avatar, país, nível, patente, rating de carreira, forma (🔥 streak), gráfico de rating por partida, stats de carreira (K/D, ADR, HS%, clutches, rating por temporada), mapas com winrate, arma mais usada, classe/build atual **pública**, histórico de partidas, showcase de cosméticos, badges de ranking. Fase 3: orgs/contratos e troféus.

---

## 13. Fase 3 — carreira pro (esboço)

Orgs de paródia olheiram por **rating** (não patente). Passou de X no ranking por 2 semanas → proposta. Contrato = moeda diária passiva + uniforme cosmético exclusivo + campeonatos com bracket. Orgs têm tier; org maior compra o jogador. Partidas oficiais no calendário; ausente = boneco joga passivo, rende menos. Rejeitar contrato é uma decisão real.

---

## 14. Dados / persistência

Fase 1 (Dexie):
- `character` (1 registro): atributos, lvl, xp, classe/build, cosméticos equipados
- `cards`, `cosmetics`: inventário com quantidade/nível
- `matches`: log comprimido + stats + rating (últimas 200)
- `training`: sessões do dia (pra rendimento decrescente)
- `settings`

Fase 2 (Supabase): mesmas tabelas por `user_id` com RLS; `matches_online` com seed + inputs (log reconstruído no cliente); `queue`; `seasons`; `ratings_ladder` (view materializada).

---

## 15. Glossário
- **Barra**: atributo base do boneco, sobe só com Treino/DM.
- **Carta**: item de build; modifica atributos ou comportamento.
- **Conjunto**: 3 cartas de uma classe → classe ativa.
- **Forma**: rating recente; afeta Mental inicial.
- **Presente/Passivo**: boneco jogando com ou sem o dono online.
- **Log**: saída determinística do motor; o app reproduz.
