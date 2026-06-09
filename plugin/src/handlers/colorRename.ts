/// <reference types="@figma/plugin-typings" />

interface ColorScanItem {
  nodeId: string;
  name: string;
  hex: string;
  parentNodeId?: string;
  textChildren: Array<{ nodeId: string; name: string; content: string }>;
}

interface RenameEntry {
  nodeId: string;
  newName: string;
  textUpdates: Array<{ nodeId: string; content: string }>;
  createVariable?: boolean;
  createStyle?: boolean;
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Scan selected nodes for color swatches.
 * Expects the typical frame structure: numbered frame with a colored shape + text children for codes.
 */
export async function scanColorsForRename(): Promise<{ items: ColorScanItem[] }> {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return { items: [] };

  const items: ColorScanItem[] = [];

  for (const node of selection) {
    const item = await extractColorFromNode(node);
    if (item) items.push(item);

    // If it's a container with children, scan children too (e.g., selecting a parent frame)
    if (!item && 'children' in node) {
      for (const child of (node as FrameNode).children) {
        const childItem = await extractColorFromNode(child);
        if (childItem) {
          childItem.parentNodeId = node.id;
          items.push(childItem);
        }
      }
    }
  }

  return { items };
}

async function extractColorFromNode(node: SceneNode): Promise<ColorScanItem | null> {
  // Get the dominant solid fill color from this node or its largest colored child
  let hex: string | null = null;

  if ('fills' in node) {
    const fills = (node as GeometryMixin).fills;
    if (Array.isArray(fills)) {
      const solid = fills.find(
        (f: Paint) => f.type === 'SOLID' && f.visible !== false
      ) as SolidPaint | undefined;
      if (solid) {
        hex = rgbToHex(solid.color.r, solid.color.g, solid.color.b);
      }
    }
  }

  // For frames, also look for the largest colored child (the swatch area)
  if (!hex && 'children' in node) {
    let bestArea = 0;
    for (const child of (node as FrameNode).children) {
      if (child.type === 'TEXT') continue;
      if ('fills' in child) {
        const fills = (child as GeometryMixin).fills;
        if (Array.isArray(fills)) {
          const solid = fills.find(
            (f: Paint) => f.type === 'SOLID' && f.visible !== false
          ) as SolidPaint | undefined;
          if (solid) {
            const area = child.width * child.height;
            if (area > bestArea) {
              bestArea = area;
              hex = rgbToHex(solid.color.r, solid.color.g, solid.color.b);
            }
          }
        }
      }
    }
  }

  if (!hex) return null;

  // Collect text children for code updates
  const textChildren: ColorScanItem['textChildren'] = [];
  if ('children' in node) {
    collectTextNodes(node as FrameNode, textChildren);
  }

  return {
    nodeId: node.id,
    name: node.name,
    hex,
    textChildren,
  };
}

function collectTextNodes(
  parent: FrameNode | GroupNode,
  out: ColorScanItem['textChildren']
) {
  for (const child of parent.children) {
    if (child.type === 'TEXT') {
      const textNode = child as TextNode;
      const content =
        typeof textNode.characters === 'string' ? textNode.characters : '';
      out.push({ nodeId: child.id, name: child.name, content });
    } else if ('children' in child) {
      collectTextNodes(child as FrameNode, out);
    }
  }
}

/**
 * Apply AI-generated renames: rename frames + update text children + optionally create variables/styles.
 */
export async function applyColorRename(payload: {
  renames: RenameEntry[];
}): Promise<{ renamed: number }> {
  let renamed = 0;

  for (const entry of payload.renames) {
    const node = await figma.getNodeByIdAsync(entry.nodeId);
    if (!node) continue;

    // Rename the frame
    node.name = entry.newName;

    // Update text children (color codes)
    for (const tu of entry.textUpdates) {
      const textNode = (await figma.getNodeByIdAsync(tu.nodeId)) as TextNode | null;
      if (!textNode || textNode.type !== 'TEXT') continue;

      // Load fonts before editing
      const segments = textNode.getStyledTextSegments(['fontName']);
      const fontsToLoad = new Set<string>();
      for (const seg of segments) {
        const fn = seg.fontName as FontName;
        const key = `${fn.family}::${fn.style}`;
        if (!fontsToLoad.has(key)) {
          fontsToLoad.add(key);
          await figma.loadFontAsync(fn);
        }
      }

      textNode.characters = tu.content;
    }

    renamed++;
  }

  // Create variables if requested
  const variableEntries = payload.renames.filter((r) => r.createVariable);
  if (variableEntries.length > 0 && figma.variables) {
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      let collection = collections.find((c: any) => c.name === 'Brand Colors');
      if (!collection) {
        collection = (figma.variables as any).createVariableCollection?.('Brand Colors');
      }

      if (collection) {
        for (const entry of variableEntries) {
          const node = await figma.getNodeByIdAsync(entry.nodeId);
          if (!node || !('fills' in node)) continue;

          const fills = (node as GeometryMixin).fills;
          if (!Array.isArray(fills)) continue;
          const solid = fills.find(
            (f: Paint) => f.type === 'SOLID' && f.visible !== false
          ) as SolidPaint | undefined;
          if (!solid) continue;

          // Clean name for variable (remove number prefix like "01 ")
          const varName = entry.newName.replace(/^\d+\s*/, '').trim();

          // Check if variable already exists
          const existingVars = await figma.variables.getLocalVariablesAsync('COLOR');
          const exists = existingVars.some(
            (v: Variable) =>
              v.name === varName && v.variableCollectionId === collection!.id
          );
          if (exists) continue;

          const variable = (figma.variables as any).createVariable?.(
            varName,
            collection.id,
            'COLOR'
          );
          if (variable) {
            variable.setValueForMode(collection.defaultModeId, {
              r: solid.color.r,
              g: solid.color.g,
              b: solid.color.b,
              a: solid.opacity ?? 1,
            });
          }
        }
      }
    } catch (e) {
      console.error('[colorRename] Failed to create variables:', e);
    }
  }

  // Create paint styles if requested
  const styleEntries = payload.renames.filter((r) => r.createStyle);
  if (styleEntries.length > 0) {
    try {
      const localStyles = await figma.getLocalPaintStylesAsync();

      for (const entry of styleEntries) {
        const node = await figma.getNodeByIdAsync(entry.nodeId);
        if (!node || !('fills' in node)) continue;

        const fills = (node as GeometryMixin).fills;
        if (!Array.isArray(fills)) continue;
        const solid = fills.find(
          (f: Paint) => f.type === 'SOLID' && f.visible !== false
        ) as SolidPaint | undefined;
        if (!solid) continue;

        const styleName = entry.newName.replace(/^\d+\s*/, '').trim();
        const exists = localStyles.some((s) => s.name === styleName);
        if (exists) continue;

        const style = figma.createPaintStyle();
        style.name = styleName;
        style.paints = [{ type: 'SOLID', color: solid.color, opacity: solid.opacity ?? 1 }];
      }
    } catch (e) {
      console.error('[colorRename] Failed to create styles:', e);
    }
  }

  return { renamed };
}
