/// <reference types="@figma/plugin-typings" />

interface PresetOptions {
  format?: string;   // 'Story' | 'Feed' | custom
  variant?: string;  // 'Lava' | 'Off-White' | custom (only for single frame)
}

const SECTION_NAMES: Record<string, string> = {
  '{{titulo}}': 'Section/Title',
  '{{briefing}}': 'Section/Briefing',
  '{{data}}': 'Section/Metadata',
  '{{canal}}': 'Section/Metadata',
  '{{codigo}}': 'Section/Metadata',
};

function isLockedIn(node: BaseNode, root: FrameNode): boolean {
  let current: BaseNode | null = node;
  while (current && current.id !== root.id) {
    if ('locked' in current && (current as SceneNode).locked) return true;
    current = current.parent;
  }
  return false;
}

async function processFrame(frame: FrameNode, format: string, variant: string) {
  // ── 1. Collect text nodes (skip locked) ──
  const textNodes: { node: TextNode; fontSize: number; absY: number }[] = [];
  frame.findAll(n => n.type === 'TEXT' && !isLockedIn(n, frame)).forEach(n => {
    const t = n as TextNode;
    const size = typeof t.fontSize === 'number' ? t.fontSize : 0;
    const absY = t.absoluteTransform[1][2] - frame.absoluteTransform[1][2];
    textNodes.push({ node: t, fontSize: size, absY });
  });

  if (textNodes.length === 0) return { skipped: true, name: frame.name, reason: 'no text nodes' };

  // ── 2. Auto-map by font size + position ──
  const bySizeDesc = [...textNodes].sort((a, b) => b.fontSize - a.fontSize);
  const mapped: Map<string, TextNode> = new Map();
  const used = new Set<string>();

  mapped.set('{{titulo}}', bySizeDesc[0].node);
  used.add(bySizeDesc[0].node.id);

  if (bySizeDesc.length >= 2) {
    mapped.set('{{briefing}}', bySizeDesc[1].node);
    used.add(bySizeDesc[1].node.id);
  }

  const remaining = textNodes
    .filter(t => !used.has(t.node.id))
    .sort((a, b) => a.absY - b.absY);

  const metaSlots = ['{{data}}', '{{canal}}', '{{codigo}}'];
  remaining.forEach((t, i) => {
    if (i < metaSlots.length) mapped.set(metaSlots[i], t.node);
  });

  // ── 3. Load fonts, rename text nodes ──
  for (const [placeholder, node] of mapped) {
    const segments = node.getStyledTextSegments(['fontName']);
    for (const seg of segments) {
      await figma.loadFontAsync(seg.fontName);
    }
    node.name = placeholder;
    node.characters = placeholder;
  }

  // ── 4. Rename parent containers ──
  const renamedSections = new Set<string>();
  for (const [placeholder, node] of mapped) {
    const sectionName = SECTION_NAMES[placeholder];
    if (!sectionName) continue;
    let parent = node.parent;
    while (parent && parent.id !== frame.id) {
      const p = parent as SceneNode;
      if (p.type === 'FRAME' || p.type === 'GROUP') {
        if (!renamedSections.has(p.id)) {
          p.name = sectionName;
          renamedSections.add(p.id);
        }
        break;
      }
      parent = parent.parent;
    }
  }

  // ── 5. Rename generic layers ──
  let graphicIdx = 0;
  for (const child of frame.children) {
    if (renamedSections.has(child.id)) continue;
    if (child.locked) continue;
    const name = child.name.toLowerCase();
    if (child.type === 'INSTANCE') continue;
    if (name.startsWith('section/') || name.startsWith('template')) continue;
    if (name.startsWith('image/') || name.startsWith('graphic/')) continue;

    if (child.type === 'RECTANGLE' && child.width > frame.width * 0.5) {
      child.name = 'Image/Background';
      continue;
    }
    if (child.type === 'GROUP') {
      const hasText = (child as GroupNode).findOne(n => n.type === 'TEXT');
      if (!hasText) {
        child.name = `Graphic/Elements${graphicIdx > 0 ? ` ${graphicIdx + 1}` : ''}`;
        graphicIdx++;
        continue;
      }
    }
    if (child.type === 'ELLIPSE') {
      child.name = `Ellipse ${child.name.match(/\d+/) ? child.name.match(/\d+/)![0] : graphicIdx + 1}`;
      continue;
    }
  }

  // ── 6. Rename root frame ──
  frame.name = `Template - ${format} :: ${variant}`;

  return {
    skipped: false,
    frameName: frame.name,
    frameId: frame.id,
    mappedCount: mapped.size,
  };
}

export async function convertToPreset(opts: PresetOptions = {}) {
  const sel = figma.currentPage.selection;
  const frames = sel.filter(n => n.type === 'FRAME') as FrameNode[];

  if (frames.length === 0) {
    throw new Error('Selecione ao menos 1 frame para converter em preset.');
  }

  const format = opts.format || 'Story';
  const results = [];

  for (const frame of frames) {
    const variant = frames.length === 1 && opts.variant
      ? opts.variant
      : frame.name;
    const result = await processFrame(frame, format, variant);
    results.push(result);
  }

  return {
    total: frames.length,
    converted: results.filter(r => !r.skipped).length,
    skipped: results.filter(r => r.skipped).length,
    results,
  };
}
