/// <reference types="@figma/plugin-typings" />

import type { SerializedContext, SerializedNode, SerializedFill } from '../../../src/lib/figma-types';

/**
 * Deep node serialization for context extraction
 */
export async function serializeNode(node: SceneNode, depth = 0, maxDepth = 12): Promise<SerializedNode> {
  const base: SerializedNode = {
    id: node.id,
    type: node.type,
    name: node.name,
    width: 'width' in node ? (node as any).width : 0,
    height: 'height' in node ? (node as any).height : 0,
    x: 'x' in node ? (node as any).x : undefined,
    y: 'y' in node ? (node as any).y : undefined,
  };

  // Auto-layout info
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    const frame = node as FrameNode;
    base.layoutMode = frame.layoutMode;
    base.itemSpacing = frame.itemSpacing;
    base.paddingTop = frame.paddingTop;
    base.paddingRight = frame.paddingRight;
    base.paddingBottom = frame.paddingBottom;
    base.paddingLeft = frame.paddingLeft;
    base.primaryAxisAlignItems = frame.primaryAxisAlignItems;
    base.counterAxisAlignItems = frame.counterAxisAlignItems;
    base.childCount = frame.children.length;
  }

  // Fills
  if ('fills' in node && Array.isArray(node.fills)) {
    base.fills = (node.fills as ReadonlyArray<Paint>).map((f: Paint) => {
      const fill: SerializedFill = {
        type: f.type,
        opacity: 'opacity' in f ? (f as SolidPaint).opacity : undefined,
      };
      if (f.type === 'SOLID') {
        fill.color = (f as SolidPaint).color;
      } else if (f.type === 'IMAGE') {
        fill.imageHash = (f as ImagePaint).imageHash;
        fill.scaleMode = (f as ImagePaint).scaleMode;
      }
      return fill;
    });
  }

  // Strokes
  if ('strokes' in node && Array.isArray(node.strokes) && (node.strokes as any).length > 0) {
    base.strokes = (node.strokes as ReadonlyArray<Paint>).map((s: Paint) => ({
      type: s.type,
      color: s.type === 'SOLID' ? (s as SolidPaint).color : undefined,
      opacity: 'opacity' in s ? (s as SolidPaint).opacity : undefined,
    }));
    if ('strokeWeight' in node) base.strokeWeight = (node as any).strokeWeight;
  }

  // Effects
  if ('effects' in node && Array.isArray((node as any).effects) && (node as any).effects.length > 0) {
    base.effects = (node as any).effects.map((e: Effect) => ({
      type: e.type,
      radius: 'radius' in e ? e.radius : undefined,
      color: 'color' in e ? e.color : undefined,
      offset: 'offset' in e ? e.offset : undefined,
    }));
  }

  // Opacity
  if ('opacity' in node && (node as any).opacity !== 1) {
    base.opacity = (node as any).opacity;
  }

  // Constraints
  if ('constraints' in node) {
    base.constraints = (node as any).constraints;
  }

  // Layout sizing
  if ('layoutSizingHorizontal' in node) {
    base.layoutSizingHorizontal = (node as any).layoutSizingHorizontal;
    base.layoutSizingVertical = (node as any).layoutSizingVertical;
  }

  // Corner radius
  if ('cornerRadius' in node && typeof (node as any).cornerRadius === 'number') {
    base.cornerRadius = (node as any).cornerRadius;
  }

  // Text content
  if (node.type === 'TEXT') {
    base.characters = node.characters;
    if (typeof node.fontSize === 'number') {
      base.fontSize = node.fontSize;
    }
    if (typeof node.fontName !== 'symbol') {
      base.fontFamily = node.fontName.family;
      base.fontStyle = node.fontName.style;
    }
    if (node.textAlignHorizontal) base.textAlignHorizontal = node.textAlignHorizontal;
    if (node.textAlignVertical) base.textAlignVertical = node.textAlignVertical;
    if (node.textAutoResize) base.textAutoResize = node.textAutoResize;
  }

  // Instance info
  if (node.type === 'INSTANCE') {
    try {
      const mainComp = await node.getMainComponentAsync();
      if (mainComp) {
        base.componentKey = mainComp.key;
        base.componentName = mainComp.name;
      }
    } catch {
      // Component may not be accessible
    }
  }

  // Recursively serialize children
  if ('children' in node && (node as any).children && depth < maxDepth) {
    const children: SerializedNode[] = [];
    for (const child of (node as any).children as SceneNode[]) {
      children.push(await serializeNode(child, depth + 1, maxDepth));
    }
    base.children = children;
  }

  return base;
}

/**
 * Serialize current selection
 */
export async function serializeSelection(): Promise<SerializedContext> {
  const nodes: SerializedNode[] = [];
  const selection = figma.currentPage.selection;
  const limit = 20;

  for (let i = 0; i < Math.min(selection.length, limit); i++) {
    nodes.push(await serializeNode(selection[i]));
  }

  const styles: Record<string, string> = {};
  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    const textStyles = await figma.getLocalTextStylesAsync();
    for (const s of paintStyles) styles[s.id] = `PAINT:${s.name}`;
    for (const s of textStyles) styles[s.id] = `TEXT:${s.name}`;
  } catch {
    // Styles might not be available
  }

  return { nodes, styles };
}

/**
 * Serialize entire page (shallow)
 */
export async function serializePage(): Promise<SerializedContext> {
  const nodes: SerializedNode[] = [];
  const pageChildren = figma.currentPage.children;
  const limit = 50;
  const maxDepth = 5;

  for (let i = 0; i < Math.min(pageChildren.length, limit); i++) {
    nodes.push(await serializeNode(pageChildren[i], 0, maxDepth));
  }

  const styles: Record<string, string> = {};
  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    const textStyles = await figma.getLocalTextStylesAsync();
    for (const s of paintStyles) styles[s.id] = `PAINT:${s.name}`;
    for (const s of textStyles) styles[s.id] = `TEXT:${s.name}`;
  } catch {
    // Styles might not be available
  }

  return { nodes, styles };
}
