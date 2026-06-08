/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  url: string;
  state: { name: string; type: string };
  labels: { nodes: { name: string }[] };
}

interface ParsedIssue {
  codigo: string;
  titulo: string;
  canal: string;
  briefing: string;
  data: string;
  month: number | null;
}

interface PresetMap {
  [format: string]: string[];
}

interface BridgeOptions {
  linearApiKey: string;
  projectId: string;
  strategy?: 'random' | 'rotate';
  formats?: string[];       // ['Story', 'Feed'] — which formats to generate
  filterIssues?: string[];  // ['VSN-675', 'VSN-680']
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// 1. Scan Presets — reads all "Template - {format} :: {variant}" from file
// ---------------------------------------------------------------------------

export function scanPresets(): PresetMap {
  const presets: PresetMap = {};
  const seen = new Set<string>();

  figma.currentPage.findAll(n => {
    if (n.type !== 'FRAME') return false;
    return /^Template\s*-\s*\w+\s*::/.test(n.name);
  }).forEach(n => {
    const match = n.name.match(/^Template\s*-\s*(\w+)\s*::\s*(.+)$/);
    if (!match) return;
    const [, format, variant] = match;
    const key = `${format}::${variant.trim()}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!presets[format]) presets[format] = [];
    presets[format].push(variant.trim());
  });

  return presets;
}

// ---------------------------------------------------------------------------
// 2. Fetch Linear issues
// ---------------------------------------------------------------------------

async function fetchIssues(apiKey: string, projectId: string): Promise<LinearIssue[]> {
  const allIssues: LinearIssue[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({
        query: `query($projectId: ID!, $cursor: String) {
          issues(
            filter: {
              project: { id: { eq: $projectId } }
              title: { contains: "[T]" }
              state: { type: { nin: ["completed", "canceled"] } }
            }
            first: 50
            after: $cursor
            orderBy: updatedAt
          ) {
            pageInfo { hasNextPage endCursor }
            nodes { id identifier title description dueDate url state { name type } labels { nodes { name } } }
          }
        }`,
        variables: { projectId, cursor },
      }),
    });

    if (!res.ok) throw new Error(`Linear API ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);

    allIssues.push(...json.data.issues.nodes);
    hasMore = json.data.issues.pageInfo.hasNextPage;
    cursor = json.data.issues.pageInfo.endCursor;
  }

  return allIssues;
}

// ---------------------------------------------------------------------------
// 3. Parse issue fields
// ---------------------------------------------------------------------------

function parseIssue(issue: LinearIssue): ParsedIssue {
  const titleMatch = issue.title.match(/\[T\]\s*\[Construir Aí\]\s*(.+?)(?:\s*—\s*(.+))?$/);

  let canal = '';
  let titulo = issue.title;

  if (titleMatch) {
    const rawCanal = titleMatch[1] || '';
    const rawTitulo = titleMatch[2] || titleMatch[1] || '';
    if (rawTitulo && /e-?mail|insta/i.test(rawCanal)) {
      canal = rawCanal.trim();
      titulo = rawTitulo.trim();
    } else {
      titulo = `${rawCanal} ${rawTitulo}`.trim();
    }
  }

  titulo = titulo.replace(/\s*\(\d{2}\/\d{2}\)\s*$/, '');

  let briefing = '';
  if (issue.description) {
    const lines = issue.description.trim().split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (/feed|stories|e-?mail/i.test(lastLine)) {
      if (!canal) canal = lastLine;
      briefing = lines.slice(0, -1).join(' ').trim();
    } else {
      briefing = issue.description.trim().replace(/\n+/g, ' ');
    }
  }
  briefing = briefing.replace(/["""""]/g, '').replace(/\s{2,}/g, ' ').trim();

  let data = '';
  let month: number | null = null;
  if (issue.dueDate) {
    const [y, m, d] = issue.dueDate.split('-');
    data = `${d}/${m}/${y}`;
    month = parseInt(m, 10);
  }

  return { codigo: issue.identifier, titulo, canal, briefing, data, month };
}

// ---------------------------------------------------------------------------
// 4. Pick variant (deterministic random or rotate)
// ---------------------------------------------------------------------------

function pickVariant(index: number, codigo: string, pool: string[], strategy: string): string {
  if (pool.length === 0) return pool[0];
  if (strategy === 'random') {
    const seed = codigo.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return pool[seed % pool.length];
  }
  return pool[index % pool.length];
}

// ---------------------------------------------------------------------------
// 5. Clone + populate — uses native Figma API directly
// ---------------------------------------------------------------------------

async function cloneAndPopulate(
  templateName: string,
  frameName: string,
  textOverrides: Record<string, string>,
  x: number,
  y: number,
): Promise<{ id: string; name: string } | null> {
  const source = figma.currentPage.findOne(
    n => n.name === templateName && n.type === 'FRAME',
  ) as FrameNode | null;

  if (!source) return null;

  const clone = source.clone();
  clone.name = frameName;
  clone.x = x;
  clone.y = y;
  figma.currentPage.appendChild(clone);

  // Apply text overrides
  for (const [layerName, content] of Object.entries(textOverrides)) {
    const textNode = clone.findOne(n => n.type === 'TEXT' && n.name === layerName) as TextNode | null;
    if (!textNode) continue;
    const segments = textNode.getStyledTextSegments(['fontName']);
    for (const seg of segments) {
      await figma.loadFontAsync(seg.fontName);
    }
    textNode.characters = content;
  }

  return { id: clone.id, name: clone.name };
}

// ---------------------------------------------------------------------------
// 6. Main pipeline
// ---------------------------------------------------------------------------

export async function linearToFigma(opts: BridgeOptions) {
  const { linearApiKey, projectId, strategy = 'random', formats = ['Story'], filterIssues, dryRun } = opts;

  // Step 1: Scan presets
  postToUI({ type: 'BRIDGE_PROGRESS', step: 'scan', message: 'Scanning templates...' });
  const presets = scanPresets();
  const formatCount = Object.values(presets).reduce((s, v) => s + v.length, 0);

  if (formatCount === 0) {
    throw new Error('Nenhum template encontrado. Use "Convert to Preset" primeiro.');
  }

  // Step 2: Fetch issues
  postToUI({ type: 'BRIDGE_PROGRESS', step: 'fetch', message: 'Fetching Linear issues...' });
  let issues = await fetchIssues(linearApiKey, projectId);

  if (filterIssues && filterIssues.length > 0) {
    issues = issues.filter(i => filterIssues.includes(i.identifier));
  }

  if (issues.length === 0) {
    throw new Error('Nenhuma issue [T] pendente encontrada.');
  }

  // Step 3: Parse + map
  postToUI({ type: 'BRIDGE_PROGRESS', step: 'map', message: `Mapping ${issues.length} issues...` });

  const operations: {
    templateName: string;
    frameName: string;
    overrides: Record<string, string>;
    parsed: ParsedIssue;
    format: string;
    variant: string;
  }[] = [];

  for (let i = 0; i < issues.length; i++) {
    const parsed = parseIssue(issues[i]);

    for (const format of formats) {
      const pool = presets[format];
      if (!pool || pool.length === 0) continue;

      const variant = pickVariant(i, parsed.codigo, pool, strategy);
      const templateName = `Template - ${format} :: ${variant}`;

      operations.push({
        templateName,
        frameName: `${parsed.codigo} — ${parsed.titulo}`,
        overrides: {
          '{{titulo}}': parsed.titulo,
          '{{briefing}}': parsed.briefing || parsed.titulo,
          '{{data}}': parsed.data,
          '{{canal}}': parsed.canal,
          '{{codigo}}': parsed.codigo,
        },
        parsed,
        format,
        variant,
      });
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      presets,
      issueCount: issues.length,
      operations: operations.map(op => ({
        template: op.templateName,
        frame: op.frameName,
        overrides: op.overrides,
      })),
    };
  }

  // Step 4: Clone & populate
  postToUI({ type: 'BRIDGE_PROGRESS', step: 'clone', message: `Creating ${operations.length} frames...` });

  // Grid positioning: find rightmost node on page as starting X
  let startX = 0;
  for (const child of figma.currentPage.children) {
    const right = child.x + child.width;
    if (right > startX) startX = right;
  }
  startX += 200;

  const COLS = 5;
  const GAP_X = 40;
  const GAP_Y = 80;

  const results: { id: string; name: string }[] = [];
  let errors: string[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    // Use first template to estimate size (1080 for story, 1080 for feed)
    const w = 1080;
    const h = op.format === 'Feed' ? 1080 : 1920;
    const x = startX + col * (w + GAP_X);
    const y = row * (h + GAP_Y);

    const result = await cloneAndPopulate(op.templateName, op.frameName, op.overrides, x, y);

    if (result) {
      results.push(result);
    } else {
      errors.push(`Template "${op.templateName}" not found for ${op.parsed.codigo}`);
    }

    if ((i + 1) % 5 === 0 || i === operations.length - 1) {
      postToUI({
        type: 'BRIDGE_PROGRESS',
        step: 'clone',
        message: `${i + 1}/${operations.length} frames created`,
      });
    }
  }

  return {
    dryRun: false,
    presets,
    issueCount: issues.length,
    created: results.length,
    errors,
    createdNodeIds: results.map(r => r.id),
  };
}

// ---------------------------------------------------------------------------
// 7. Storage helpers for Linear credentials
// ---------------------------------------------------------------------------

export async function saveLinearConfig(config: { apiKey: string; projectId: string }) {
  await figma.clientStorage.setAsync('linearApiKey', config.apiKey);
  await figma.clientStorage.setAsync('linearProjectId', config.projectId);
}

export async function getLinearConfig(): Promise<{ apiKey: string; projectId: string }> {
  const apiKey = (await figma.clientStorage.getAsync('linearApiKey')) || '';
  const projectId = (await figma.clientStorage.getAsync('linearProjectId')) || '';
  return { apiKey, projectId };
}
