/// <reference types="@figma/plugin-typings" />

/**
 * EXPORT_FRAMES_DATA — deterministic frame data export.
 *
 * Walks every frame in scope, collects ALL text layers (no token limit, no LLM
 * hallucination) and serializes to json / markdown / html / csv. Best-effort
 * `fields` mapping (label:value + money heuristic) layers a structured schema on
 * top of the always-complete `texts` array, so nothing is ever lost.
 */

export interface FrameRecord {
  id: string;
  name: string;
  width: number;
  height: number;
  texts: string[];
  fields?: Record<string, string>;
}

export interface ExportResult {
  filename: string;
  content: string;
  mimeType: string;
  frameCount: number;
  format: string;
}

const MONEY_RE = /(r\$|\$|€|£)\s?\d|[\d.]+,\d{2}\b/i;

function collectTexts(node: BaseNode, out: string[]) {
  if ('visible' in node && !(node as SceneNode).visible) return;
  if (node.type === 'TEXT') {
    const t = (node as TextNode).characters.trim();
    if (t) out.push(t);
    return;
  }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) collectTexts(child, out);
  }
}

/** Best-effort: match a requested field name against this frame's texts. */
function matchField(field: string, texts: string[]): string | undefined {
  const key = field.toLowerCase();
  // 1. "Label: value" pattern (e.g. "Cliente: Lucas")
  for (const t of texts) {
    const idx = t.indexOf(':');
    if (idx > 0 && t.slice(0, idx).trim().toLowerCase() === key) {
      return t.slice(idx + 1).trim();
    }
  }
  // 2. Money heuristic for value-ish fields
  if (/(valor|preç|preco|price|total|amount|orçament|orcament)/.test(key)) {
    const money = texts.find((t) => MONEY_RE.test(t));
    if (money) return money.trim();
  }
  return undefined;
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'export';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(s: string): string {
  const v = s.replace(/"/g, '""');
  return /[",\n]/.test(v) ? `"${v}"` : v;
}

function toJson(records: FrameRecord[]): string {
  return JSON.stringify(records, null, 2);
}

function toMarkdown(records: FrameRecord[], title: string, fields?: string[]): string {
  let md = `# ${title}\n\n_${records.length} frames_\n\n`;
  if (fields && fields.length) {
    md += `| Frame | ${fields.join(' | ')} |\n`;
    md += `| --- | ${fields.map(() => '---').join(' | ')} |\n`;
    for (const r of records) {
      const cells = fields.map((f) => (r.fields?.[f] ?? '').replace(/\n/g, ' '));
      md += `| ${r.name} | ${cells.join(' | ')} |\n`;
    }
    return md;
  }
  for (const r of records) {
    md += `## ${r.name}\n\n`;
    for (const t of r.texts) md += `- ${t.replace(/\n/g, ' ')}\n`;
    md += '\n';
  }
  return md;
}

function toHtml(records: FrameRecord[], title: string, fields?: string[]): string {
  const cols = fields && fields.length ? ['Frame', ...fields] : ['Frame', 'Texts'];
  const head = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const rows = records
    .map((r) => {
      const cells =
        fields && fields.length
          ? [r.name, ...fields.map((f) => r.fields?.[f] ?? '')]
          : [r.name, r.texts.join(' · ')];
      return `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`;
    })
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title><style>body{font:14px/1.5 system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}th{background:#f5f5f5}</style></head><body><h1>${escapeHtml(
    title
  )}</h1><p>${records.length} frames</p><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function toCsv(records: FrameRecord[], fields?: string[]): string {
  if (fields && fields.length) {
    const header = ['frame', ...fields].map(csvCell).join(',');
    const lines = records.map((r) =>
      [r.name, ...fields.map((f) => r.fields?.[f] ?? '')].map(csvCell).join(',')
    );
    return [header, ...lines].join('\n');
  }
  const maxTexts = records.reduce((m, r) => Math.max(m, r.texts.length), 0);
  const header = ['frame', ...Array.from({ length: maxTexts }, (_, i) => `text_${i + 1}`)]
    .map(csvCell)
    .join(',');
  const lines = records.map((r) => [r.name, ...r.texts].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export async function exportFramesData(op: {
  format?: 'json' | 'markdown' | 'html' | 'csv';
  scope?: 'selection' | 'page';
  nodeIds?: string[];
  fields?: string[];
  title?: string;
}, snapshotSelection: readonly SceneNode[]): Promise<ExportResult> {
  const format = op.format ?? 'json';
  const fields = op.fields?.filter(Boolean);

  // Resolve scope → root frames
  let roots: readonly SceneNode[];
  if (op.nodeIds && op.nodeIds.length) {
    const resolved = await Promise.all(op.nodeIds.map((id) => figma.getNodeByIdAsync(id)));
    roots = resolved.filter((n): n is SceneNode => n !== null && 'children' in (n as any));
  } else if (op.scope === 'page') {
    roots = figma.currentPage.children;
  } else {
    roots = snapshotSelection.length ? snapshotSelection : figma.currentPage.children;
  }

  const records: FrameRecord[] = [];
  for (const root of roots) {
    const texts: string[] = [];
    collectTexts(root, texts);
    const record: FrameRecord = {
      id: root.id,
      name: root.name,
      width: Math.round(root.width),
      height: Math.round(root.height),
      texts,
    };
    if (fields && fields.length) {
      record.fields = {};
      for (const f of fields) record.fields[f] = matchField(f, texts) ?? '';
    }
    records.push(record);
  }

  const docName = figma.root.name || 'Figma';
  const title = op.title || docName;

  let content: string;
  let mimeType: string;
  let ext: string;
  switch (format) {
    case 'markdown':
      content = toMarkdown(records, title, fields);
      mimeType = 'text/markdown';
      ext = 'md';
      break;
    case 'html':
      content = toHtml(records, title, fields);
      mimeType = 'text/html';
      ext = 'html';
      break;
    case 'csv':
      content = toCsv(records, fields);
      mimeType = 'text/csv';
      ext = 'csv';
      break;
    case 'json':
    default:
      content = toJson(records);
      mimeType = 'application/json';
      ext = 'json';
      break;
  }

  return {
    filename: `${sanitize(title)}_frames.${ext}`,
    content,
    mimeType,
    frameCount: records.length,
    format,
  };
}
