---
title: "Skins: direção de arte"
labels: [help-wanted, art, pinned]
pinned: true
---
**GDD:** 7 (Cosméticos) · docs/SKINS.md

## Onde estamos
Existem 17 padrões de skin já definidos (docs/SKINS.md). Gerei renders por IA a partir deles e não gostei: sem identidade, inconsistentes entre armas, não se leem no ícone pequeno do kill feed. A direção de arte está **em aberto**.

## O que foi tentado e não funcionou
- Renders por IA a partir de descrição textual dos padrões.
- Aplicar textura genérica sobre os ícones de arma atuais (`apps/web/src/match/WeaponIcon.tsx`).

## O pedido
**Proposta visual antes de pipeline.** Quero ver 2–3 padrões aplicados numa arma (AK, AWP) em dois tamanhos: ícone do kill feed (~24px de altura) e card do inventário (~200px). Estilo, paleta e como a raridade aparece. Pode ser SVG, PNG ou até Figma. Só depois de escolher a direção a gente fala de como gerar as 17 × N armas.

## Regras
Cosméticos originais, nada que lembre skin existente do CS. Ícones de arma são nossos.

## Pronto quando
Uma proposta aprovada em comentário nesta issue, com os arquivos-fonte commitados em `docs/skins/` e um plano de produção pras 17.
