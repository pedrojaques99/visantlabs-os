/// <reference types="@figma/plugin-typings" />

interface TextEntry {
  page: string;
  frame: string;
  layerPath: string;
  characters: string;
}

function collectTexts(node: BaseNode, path: string, entries: TextEntry[], page: string, frame: string, includeHidden: boolean) {
  if (!includeHidden && 'visible' in node && !node.visible) return;

  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    if (textNode.characters.trim()) {
      entries.push({ page, frame, layerPath: path, characters: textNode.characters });
    }
  }

  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      const childPath = path ? `${path} > ${child.name}` : child.name;
      collectTexts(child, childPath, entries, page, frame, includeHidden);
    }
  }
}

export async function exportTextToMarkdown(opts: { includeHidden?: boolean }): Promise<{ markdown: string; filename: string }> {
  const includeHidden = opts.includeHidden ?? false;
  const entries: TextEntry[] = [];
  const page = figma.currentPage;
  const pageName = page.name || 'Untitled';
  const docName = figma.root.name || 'Untitled';

  for (const topLevel of page.children) {
    collectTexts(topLevel, topLevel.name, entries, pageName, topLevel.name, includeHidden);
  }

  let md = `# ${docName} — ${pageName}\n\n`;
  let currentFrame = '';

  for (const entry of entries) {
    if (entry.frame !== currentFrame) {
      currentFrame = entry.frame;
      md += `## ${currentFrame}\n\n`;
    }
    md += `${entry.characters}\n\n`;
  }

  if (entries.length === 0) {
    md += '_No text layers found on this page._\n';
  }

  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitize(docName)}_${sanitize(pageName)}_texts.md`;
  return { markdown: md, filename };
}
