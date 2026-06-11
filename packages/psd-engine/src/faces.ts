// Deriva as "faces" editáveis de um PSD a partir dos smart objects escaneados.
// Face = grupo de SOs vinculados (mesmo placedLayer.id = mesmo conteúdo embutido).
// Padrão BOXY: cópia editável "(Edite Aqui)" (hidden ou fill 0) + cópia visível
// com máscara/perspectiva. Trocar a arte em qualquer um troca em todos —
// o render-server já replica via replaceLinkedSmartObjects.

import { SO_TARGET, SO_DECOR } from './constants.js';
import type { Face, FaceSo } from './types.js';

export type { Face, FaceSo } from './types.js';

/** Nome de exibição: tira "(Edite Aqui)", "(!)", "*" e afins. */
function displayName(name: string): string {
  const cleaned = name
    .replace(/double\s*.?click[^)\]]*/gi, '')
    .replace(/edit[ea]?r?\s*(aqui|here)?/gi, '')
    .replace(/your\s*(design|image|artwork)\s*(here)?/gi, '')
    .replace(/place\s*here/gi, '')
    .replace(/[()[\]*!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Arte';
}

/**
 * Agrupa SOs por linkId e filtra os grupos que são faces editáveis:
 * - grupo com membro batendo SO_TARGET → face
 * - senão, grupo com membro visível cujo nome não é decorativo → face
 * Grupos só de Sombra/Luz/Grain/etc. ou totalmente ocultos ficam de fora.
 */
export function computeFaces(smartObjects: FaceSo[]): Face[] {
  if (!smartObjects?.length) return [];

  const groups = new Map<string, FaceSo[]>();
  for (const so of smartObjects) {
    const key = so.linkId || `path:${so.path || so.name}`;
    const list = groups.get(key);
    if (list) list.push(so);
    else groups.set(key, [so]);
  }

  const faces: Face[] = [];
  for (const [key, members] of groups) {
    const nameTarget = (so: FaceSo) => SO_TARGET.test(so.name || '');
    const pathTarget = (so: FaceSo) => SO_TARGET.test(so.path || '');
    const hasTarget = members.some((so) => nameTarget(so) || pathTarget(so));
    const visibleNonDecor = members.filter((so) => !so.hidden && !SO_DECOR.test(so.name || ''));

    if (!hasTarget && visibleNonDecor.length === 0) continue;

    // Representante: o que bate SO_TARGET no NOME (é o que o template manda
    // editar), senão no path, senão o visível não-decorativo, senão o primeiro.
    const repr = members.find(nameTarget) || members.find(pathTarget) || visibleNonDecor[0] || members[0];
    faces.push({
      key,
      name: displayName(repr.name),
      smartObject: repr.path || repr.name,
      innerWidth: repr.innerWidth,
      innerHeight: repr.innerHeight,
      linkedCount: members.length,
    });
  }

  // Sem face detectada mas há SOs não-decorativos? Usa o maior como única face.
  if (faces.length === 0) {
    const candidates = smartObjects.filter((so) => !SO_DECOR.test(so.name || ''));
    const pool = candidates.length ? candidates : smartObjects;
    const largest = pool.reduce((a, b) =>
      b.innerWidth * b.innerHeight > a.innerWidth * a.innerHeight ? b : a
    );
    faces.push({
      key: largest.linkId || `path:${largest.path || largest.name}`,
      name: displayName(largest.name),
      smartObject: largest.path || largest.name,
      innerWidth: largest.innerWidth,
      innerHeight: largest.innerHeight,
      linkedCount: 1,
    });
  }

  // Nomes duplicados ("Arte", "Arte") → sufixa índice pra UI
  const counts = new Map<string, number>();
  for (const f of faces) counts.set(f.name, (counts.get(f.name) || 0) + 1);
  const seen = new Map<string, number>();
  for (const f of faces) {
    if ((counts.get(f.name) || 0) > 1) {
      const n = (seen.get(f.name) || 0) + 1;
      seen.set(f.name, n);
      f.name = `${f.name} ${n}`;
    }
  }

  return faces;
}
