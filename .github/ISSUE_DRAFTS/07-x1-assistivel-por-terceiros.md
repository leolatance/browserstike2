---
title: "x1 assistível por terceiros"
labels: [online, web]
---
**GDD:** 10.1b (x1) · 9 (tela HLTV).

## Ideia
Quem tem o link `/x1/partida/:id` e não é participante entra como **espectador**: vê o mesmo replay (build) ou os dois alvos (mira) em tempo real, sem poder tocar. Base: os dois clientes já rodam a mesma sim pela seed; o espectador só precisa do `x1_matches` (config + seed + start_at) e de assinar o canal (broadcast/presença).

## Pronto quando
- Policy de leitura de `x1_matches` pra qualquer autenticado **só dos campos necessários** (view), sem expor `result` antes do fim.
- Tela de espectador com contador "N assistindo" (presença).
- Não mexe no árbitro do x1 de mira: espectador não manda `shot`.
