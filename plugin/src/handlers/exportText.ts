/// <reference types="@figma/plugin-typings" />

interface TextEntry {
  frame: string;
  section: string;
  characters: string;
  fontSize: number;
  fontWeight: number;
  layerName: string;
}

function getFontSize(node: TextNode): number {
  const size = node.fontSize;
  return typeof size === 'number' ? size : 16;
}

function getFontWeight(node: TextNode): number {
  const style = node.fontName;
  if (style === figma.mixed) return 400;
  const name = (style as FontName).style.toLowerCase();
  if (name.includes('bold') || name.includes('black') || name.includes('heavy')) return 700;
  if (name.includes('semi') || name.includes('medium')) return 500;
  return 400;
}

function collectTexts(node: BaseNode, entries: TextEntry[], frame: string, section: string, includeHidden: boolean) {
  if (!includeHidden && 'visible' in node && !node.visible) return;

  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    const text = textNode.characters.trim();
    if (text) {
      entries.push({
        frame,
        section,
        characters: text,
        fontSize: getFontSize(textNode),
        fontWeight: getFontWeight(textNode),
        layerName: textNode.name,
      });
    }
    return;
  }

  if ('children' in node) {
    const container = node as FrameNode & ChildrenMixin;
    const childSection = container.name || section;
    for (const child of container.children) {
      collectTexts(child, entries, frame, childSection, includeHidden);
    }
  }
}

function formatEntry(entry: TextEntry, maxFontSize: number): string {
  const ratio = entry.fontSize / maxFontSize;

  if (ratio >= 0.85 && entry.fontWeight >= 500) {
    return `### ${entry.characters}\n`;
  }
  if (ratio >= 0.6 && entry.fontWeight >= 500) {
    return `**${entry.characters}**\n`;
  }
  if (entry.characters.length < 60 && entry.characters.startsWith('-')) {
    return `${entry.characters}\n`;
  }
  if (entry.characters.includes('\n')) {
    return `${entry.characters}\n`;
  }
  return `${entry.characters}\n`;
}

export async function exportTextToMarkdown(opts: { includeHidden?: boolean }): Promise<{ markdown: string; filename: string }> {
  const includeHidden = opts.includeHidden ?? false;
  const entries: TextEntry[] = [];
  const page = figma.currentPage;
  const pageName = page.name || 'Untitled';
  const docName = figma.root.name || 'Untitled';

  for (const topLevel of page.children) {
    collectTexts(topLevel, entries, topLevel.name, topLevel.name, includeHidden);
  }

  if (entries.length === 0) {
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      markdown: `# ${docName} — ${pageName}\n\n_No text layers found on this page._\n`,
      filename: `${sanitize(docName)}_${sanitize(pageName)}_texts.md`,
    };
  }

  const maxFontSize = Math.max(...entries.map((e) => e.fontSize));

  let md = `# ${docName} — ${pageName}\n\n`;
  let currentFrame = '';
  let currentSection = '';

  for (const entry of entries) {
    if (entry.frame !== currentFrame) {
      currentFrame = entry.frame;
      currentSection = '';
      md += `## ${currentFrame}\n\n`;
    }
    if (entry.section !== currentSection && entry.section !== currentFrame) {
      currentSection = entry.section;
      md += `#### ${currentSection}\n\n`;
    }
    md += formatEntry(entry, maxFontSize) + '\n';
  }

  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitize(docName)}_${sanitize(pageName)}_texts.md`;
  return { markdown: md, filename };
}
