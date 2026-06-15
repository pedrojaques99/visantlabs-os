/**
 * Pure formatting + field-matching logic for EXPORT_FRAMES_DATA.
 *
 * No Figma API references — kept separate from the node walker so it can be
 * unit-tested directly. The walker (exportFramesData.ts) produces FrameRecord[]
 * and delegates serialization here.
 */

export interface TextItem {
  layer: string;
  text: string;
}

export interface FrameRecord {
  id: string;
  name: string;
  width: number;
  height: number;
  texts: TextItem[];
  fields?: Record<string, string>;
}

export type ExportFormat = 'json' | 'markdown' | 'html' | 'csv';

const MONEY_RE = /(r\$|\$|€|£)\s?\d|\d[.\d]*,\d{2}\b/i;
const VALUE_FIELD_RE = /(valor|preç|preco|price|total|amount|custo|orçament|orcament)/;

/**
 * Best-effort mapping of a requested field name to a value within a frame's
 * text layers. Priority (strongest deterministic signal first):
 *  1. Layer NAME matches the field (designers often name layers "cliente").
 *  2. Inline "Label: value" inside a single text.
 *  3. Sibling pattern — a text that IS the label, value is the next text.
 *  4. Money heuristic for value-ish fields.
 */
export function matchField(field: string, items: TextItem[]): string | undefined {
  const key = field.toLowerCase().trim();
  if (!key) return undefined;

  // 1. Layer name
  for (const it of items) {
    const ln = it.layer.toLowerCase();
    if (ln === key || ln.includes(key)) {
      const inline = stripInlineLabel(it.text, key);
      return inline ?? it.text.trim();
    }
  }

  // 2. Inline "Label: value"
  for (const it of items) {
    const v = stripInlineLabel(it.text, key);
    if (v) return v;
  }

  // 3. Sibling: text == label, value is the following text
  for (let i = 0; i < items.length; i++) {
    const label = items[i].text
      .toLowerCase()
      .replace(/[:：]\s*$/, '')
      .trim();
    if (label === key && items[i + 1]) return items[i + 1].text.trim();
  }

  // 4. Money heuristic
  if (VALUE_FIELD_RE.test(key)) {
    const money = items.find((it) => MONEY_RE.test(it.text));
    if (money) return money.text.trim();
  }

  return undefined;
}

function stripInlineLabel(text: string, key: string): string | undefined {
  const idx = text.indexOf(':');
  if (idx > 0 && text.slice(0, idx).trim().toLowerCase() === key) {
    return text.slice(idx + 1).trim();
  }
  return undefined;
}

/** Populate record.fields for the requested field list. */
export function buildFields(items: TextItem[], fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) out[f] = matchField(f, items) ?? '';
  return out;
}

export function sanitizeFilename(s: string): string {
  return (
    s
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60) || 'export'
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(s: string): string {
  const v = String(s).replace(/"/g, '""');
  return /[",\n]/.test(v) ? `"${v}"` : v;
}

/** Escape a value for use inside a markdown table cell. */
function mdCell(s: string): string {
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function toJson(records: FrameRecord[], fields?: string[]): string {
  if (fields && fields.length) {
    // Tabular shape requested — emit clean rows, keep raw texts as provenance.
    const rows = records.map((r) => ({
      frame: r.name,
      ...(r.fields ?? {}),
      texts: r.texts.map((t) => t.text),
    }));
    return JSON.stringify(rows, null, 2);
  }
  const rows = records.map((r) => ({
    id: r.id,
    name: r.name,
    width: r.width,
    height: r.height,
    texts: r.texts.map((t) => t.text),
  }));
  return JSON.stringify(rows, null, 2);
}

export function toMarkdown(records: FrameRecord[], title: string, fields?: string[]): string {
  let md = `# ${title}\n\n_${records.length} frames_\n\n`;
  if (fields && fields.length) {
    md += `| Frame | ${fields.join(' | ')} |\n`;
    md += `| --- | ${fields.map(() => '---').join(' | ')} |\n`;
    for (const r of records) {
      const cells = fields.map((f) => mdCell(r.fields?.[f] ?? ''));
      md += `| ${mdCell(r.name)} | ${cells.join(' | ')} |\n`;
    }
    return md;
  }
  for (const r of records) {
    md += `## ${r.name}\n\n`;
    for (const t of r.texts) md += `- ${t.text.replace(/\r?\n/g, ' ')}\n`;
    md += '\n';
  }
  return md;
}

export function toHtml(records: FrameRecord[], title: string, fields?: string[]): string {
  const cols = fields && fields.length ? ['Frame', ...fields] : ['Frame', 'Texts'];
  const head = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const rows = records
    .map((r) => {
      const cells =
        fields && fields.length
          ? [r.name, ...fields.map((f) => r.fields?.[f] ?? '')]
          : [r.name, r.texts.map((t) => t.text).join(' · ')];
      return `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`;
    })
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title><style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}th{background:#f5f5f5}</style></head><body><h1>${escapeHtml(
    title
  )}</h1><p>${records.length} frames</p><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function toCsv(records: FrameRecord[], fields?: string[]): string {
  let body: string;
  if (fields && fields.length) {
    const header = ['frame', ...fields].map(csvCell).join(',');
    const lines = records.map((r) =>
      [r.name, ...fields.map((f) => r.fields?.[f] ?? '')].map(csvCell).join(',')
    );
    body = [header, ...lines].join('\r\n');
  } else {
    const maxTexts = records.reduce((m, r) => Math.max(m, r.texts.length), 0);
    const header = ['frame', ...Array.from({ length: maxTexts }, (_, i) => `text_${i + 1}`)]
      .map(csvCell)
      .join(',');
    const lines = records.map((r) =>
      [r.name, ...r.texts.map((t) => t.text)].map(csvCell).join(',')
    );
    body = [header, ...lines].join('\r\n');
  }
  // UTF-8 BOM so Excel renders accents (Andressa, Orçamento) correctly.
  return '﻿' + body;
}

export function formatExport(
  records: FrameRecord[],
  format: ExportFormat,
  title: string,
  fields?: string[]
): { content: string; mimeType: string; ext: string } {
  switch (format) {
    case 'markdown':
      return { content: toMarkdown(records, title, fields), mimeType: 'text/markdown', ext: 'md' };
    case 'html':
      return { content: toHtml(records, title, fields), mimeType: 'text/html', ext: 'html' };
    case 'csv':
      return { content: toCsv(records, fields), mimeType: 'text/csv', ext: 'csv' };
    case 'json':
    default:
      return { content: toJson(records, fields), mimeType: 'application/json', ext: 'json' };
  }
}
