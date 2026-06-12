// Padrões de nome de camadas em templates PSD de mockup (PT-BR + EN).
// Single source of truth — espelhado por server/lib/psd-render-constants.ts e mockup-store.

// Placeholders editáveis ("Design Here", "(!) Edite Aqui", "[DOUBLE CLICK TO EDIT]"…).
// Pontos sem escape casam "." e " " — design.here casa "Design Here".
export const SO_TARGET =
  /double.click|your.design|place.here|smart.object|\bartwork\b|\bdesign.here\b|\bedit(e|ar)?\b|\barte\b|\baqui\b|\bhere\b/i;

// Só padrões INEQUIVOCAMENTE watermark/instrução — nunca camadas de conteúdo real.
export const BRAND_HIDE =
  /\[boxy\]|remove\s*paper|\byour\s+artwork\b|\bimage\s+here\b|\btext\s+here\b|\blogo\s+here\b|delete\s+(essa\s+camada|this)\b/i;

// Smart objects decorativos (sombra/luz/textura) — nunca são faces editáveis.
export const SO_DECOR =
  /\bsombra\b|\bshadows?\b|\bluz\b|\blights?\b|\bgrain\b|\btextur\w*|\beffects?\b|\bmesh\b|\bbackground\b|\breflex\w*|\bnoise\b|\boverlay\b|\bdisplace\w*|\bblur\b|\bglow\b|\bbase\b/i;
