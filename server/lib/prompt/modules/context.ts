/**
 * Module: Selection Context
 *
 * Compact representation of selected elements.
 */

/**
 * Convert Figma RGB to hex
 */
function rgbToHex(c: any): string {
  if (!c || typeof c.r !== 'number') return '?';
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

/**
 * Flatten node tree - compact format
 */
export function flattenNodesCompact(nodes: any[], depth = 0, maxDepth = 6): string[] {
  const lines: string[] = [];

  for (const n of nodes) {
    if (depth > maxDepth) continue;

    const indent = '  '.repeat(depth);
    const parts: string[] = [`${indent}"${n.name}" (${n.type}, id:"${n.id}"`];

    if (n.width && n.height) parts.push(`${Math.round(n.width)}x${Math.round(n.height)}`);

    // Position (critical for MOVE calculations and free-canvas layouts)
    if (n.x != null && n.y != null && depth === 0)
      parts.push(`pos:${Math.round(n.x)},${Math.round(n.y)}`);

    // Fill color (first solid only)
    const solidFill = n.fills?.find((f: any) => f.type === 'SOLID' && f.color);
    if (solidFill) parts.push(`fill:${rgbToHex(solidFill.color)}`);

    // Layout
    if (n.layoutMode && n.layoutMode !== 'NONE') parts.push(`layout:${n.layoutMode}`);

    // Corner radius
    if (n.cornerRadius && n.cornerRadius > 0) parts.push(`r:${Math.round(n.cornerRadius)}`);

    // Opacity
    if (n.opacity != null && n.opacity < 1) parts.push(`op:${n.opacity}`);

    // Font info (for text nodes)
    if (n.fontFamily)
      parts.push(
        `font:"${n.fontFamily}${n.fontStyle && n.fontStyle !== 'Regular' ? ` ${n.fontStyle}` : ''}"`
      );
    if (n.fontSize) parts.push(`fs:${n.fontSize}`);

    // Component key (for identifying instances)
    if (n.componentKey) parts.push(`key:"${n.componentKey}"`);

    // Strokes (compact)
    if (n.strokes?.length && n.strokeWeight) {
      const solidStroke = n.strokes.find((s: any) => s.type === 'SOLID' && s.color);
      if (solidStroke) parts.push(`stroke:${rgbToHex(solidStroke.color)}/${n.strokeWeight}px`);
    }

    // Effects (shadow/blur presence)
    if (n.effects?.length) {
      const types = [...new Set(n.effects.map((e: any) => e.type))];
      parts.push(`fx:${types.join(',')}`);
    }

    // Text content (truncated)
    if (n.characters) parts.push(`"${n.characters.substring(0, 30)}..."`);

    lines.push(parts.join(', ') + ')');

    if (n.children?.length) {
      lines.push(...flattenNodesCompact(n.children, depth + 1, maxDepth));
    }
  }

  return lines;
}

/**
 * Build selection context
 */
export function buildSelectionContext(
  selectedElements: any[],
  maxElements = 20,
  label?: string
): string {
  if (!selectedElements?.length) {
    return 'SELECAO: Nenhum elemento selecionado (criacao vai para pagina raiz)';
  }

  const lines = flattenNodesCompact(selectedElements.slice(0, maxElements));
  const truncated =
    selectedElements.length > maxElements
      ? `\n... +${selectedElements.length - maxElements} elementos`
      : '';

  const header =
    label || 'SELECAO (use nodeId para editar, id como parentNodeId para criar dentro)';
  return `${header}:\n${lines.join('\n')}${truncated}`;
}

/**
 * Build containers hint
 */
export function buildContainersHint(selectedElements: any[]): string {
  const containerTypes = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'GROUP', 'SECTION']);
  const containers = selectedElements
    .filter((n: any) => containerTypes.has(n.type))
    .slice(0, 5)
    .map((n: any) => `"${n.name}" (id:"${n.id}")`);

  if (!containers.length) {
    return 'CONTAINERS: Nenhum (criacao vai para pagina)';
  }

  return `CONTAINERS SELECIONADOS (use como parentNodeId):\n${containers.join('\n')}`;
}
