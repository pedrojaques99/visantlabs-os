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
  projectMilestone?: { id: string; name: string } | null;
}

interface ParsedIssue {
  codigo: string;
  titulo: string;
  canal: string;
  briefing: string;
  data: string;
  month: number | null;
  incomplete: boolean;
}

interface PresetMap {
  [format: string]: string[];
}

interface BridgeOptions {
  linearApiKey: string;
  projectId: string;
  strategy?: 'random' | 'rotate';
  formats?: string[];
  filterIssues?: string[];
  milestoneId?: string;
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers: Linear GraphQL
// ---------------------------------------------------------------------------

async function gql(apiKey: string, query: string, variables: Record<string, any> = {}) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Linear ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok)
    throw new Error(`Linear ${res.status}: ${json.errors?.[0]?.message || text.slice(0, 200)}`);
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// ---------------------------------------------------------------------------
// 1. Scan Presets
// ---------------------------------------------------------------------------

export function scanPresets(): PresetMap {
  const presets: PresetMap = {};
  const seen = new Set<string>();

  figma.currentPage
    .findAll((n) => {
      if (n.type !== 'FRAME') return false;
      return /^Template\s*-\s*\w+\s*::/.test(n.name);
    })
    .forEach((n) => {
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
// 2. Fetch projects from Linear
// ---------------------------------------------------------------------------

export async function fetchProjects(apiKey: string) {
  const data = await gql(
    apiKey,
    `query {
    projects(first: 50) {
      nodes { id name }
    }
  }`
  );
  return data.projects.nodes as { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// 3. Fetch milestones for a project
// ---------------------------------------------------------------------------

export async function fetchMilestones(apiKey: string, projectId: string) {
  const data = await gql(
    apiKey,
    `query($projectId: ID!) {
    project(id: $projectId) {
      projectMilestones { nodes { id name sortOrder } }
    }
  }`,
    { projectId }
  );
  const milestones = data.project.projectMilestones.nodes as {
    id: string;
    name: string;
    sortOrder: number;
  }[];
  return milestones.sort((a, b) => a.sortOrder - b.sortOrder);
}

// ---------------------------------------------------------------------------
// 4. Fetch issues (with optional milestone filter)
// ---------------------------------------------------------------------------

async function fetchIssues(
  apiKey: string,
  projectId: string,
  milestoneId?: string
): Promise<LinearIssue[]> {
  const allIssues: LinearIssue[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  const milestoneFilter = milestoneId ? `projectMilestone: { id: { eq: "${milestoneId}" } }` : '';

  while (hasMore) {
    const data = await gql(
      apiKey,
      `query($projectId: ID!, $cursor: String) {
      issues(
        filter: {
          project: { id: { eq: $projectId } }
          title: { contains: "[T]" }
          state: { type: { nin: ["completed", "canceled"] } }
          ${milestoneFilter}
        }
        first: 50
        after: $cursor
        orderBy: updatedAt
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id identifier title description dueDate url
          state { name type }
          labels { nodes { name } }
          projectMilestone { id name }
        }
      }
    }`,
      { projectId, cursor }
    );

    allIssues.push(...data.issues.nodes);
    hasMore = data.issues.pageInfo.hasNextPage;
    cursor = data.issues.pageInfo.endCursor;
  }

  return allIssues;
}

// ---------------------------------------------------------------------------
// 5. Parse issue fields
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
  let incomplete = false;
  if (issue.description) {
    // Cut at --- separator (instructions/notes below it are ignored)
    const aboveFold = issue.description.split(/\n+---\n+/)[0].trim();
    const lines = aboveFold.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (/feed|stories|e-?mail/i.test(lastLine)) {
      if (!canal) canal = lastLine;
      briefing = lines.slice(0, -1).join(' ').trim();
    } else {
      briefing = aboveFold.replace(/\n+/g, ' ');
    }
  }
  briefing = briefing
    .replace(/["""""]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // \* or * prefix = incomplete briefing, needs manual attention
  if (/^\\?\*/.test(briefing)) {
    incomplete = true;
    briefing = briefing.replace(/^\\?\*\s*/, '');
  }

  let data = '';
  let month: number | null = null;
  if (issue.dueDate) {
    const [y, m, d] = issue.dueDate.split('-');
    data = `${d}/${m}/${y}`;
    month = parseInt(m, 10);
  }

  return { codigo: issue.identifier, titulo, canal, briefing, data, month, incomplete };
}

// ---------------------------------------------------------------------------
// 6. Pick variant
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
// 7. Clone + populate
// ---------------------------------------------------------------------------

async function cloneAndPopulate(
  templateName: string,
  frameName: string,
  textOverrides: Record<string, string>,
  x: number,
  y: number
): Promise<{ id: string; name: string } | null> {
  const source = figma.currentPage.findOne(
    (n) => n.name === templateName && n.type === 'FRAME'
  ) as FrameNode | null;

  if (!source) return null;

  const clone = source.clone();
  clone.name = frameName;
  clone.x = x;
  clone.y = y;
  figma.currentPage.appendChild(clone);

  for (const [layerName, content] of Object.entries(textOverrides)) {
    const textNode = clone.findOne(
      (n) => n.type === 'TEXT' && n.name === layerName
    ) as TextNode | null;
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
// 8. Main pipeline
// ---------------------------------------------------------------------------

export async function linearToFigma(opts: BridgeOptions) {
  const {
    linearApiKey,
    projectId,
    strategy = 'random',
    formats = ['Story'],
    filterIssues,
    milestoneId,
    dryRun,
  } = opts;

  postToUI({ type: 'BRIDGE_PROGRESS', step: 'scan', message: 'Scanning templates…' });
  const presets = scanPresets();
  const formatCount = Object.values(presets).reduce((s, v) => s + v.length, 0);

  if (formatCount === 0) {
    throw new Error('Nenhum template encontrado. Use "Convert to Preset" primeiro.');
  }

  postToUI({ type: 'BRIDGE_PROGRESS', step: 'fetch', message: 'Fetching issues…' });
  let issues = await fetchIssues(linearApiKey, projectId, milestoneId);

  if (filterIssues && filterIssues.length > 0) {
    issues = issues.filter((i) => filterIssues.includes(i.identifier));
  }

  if (issues.length === 0) {
    throw new Error('Nenhuma issue [T] pendente encontrada.');
  }

  postToUI({ type: 'BRIDGE_PROGRESS', step: 'map', message: `Mapping ${issues.length} issues…` });

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
      operations: operations.map((op) => ({
        template: op.templateName,
        frame: op.frameName,
        overrides: op.overrides,
      })),
    };
  }

  postToUI({
    type: 'BRIDGE_PROGRESS',
    step: 'clone',
    message: `Creating ${operations.length} frames…`,
  });

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
  const errors: string[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const w = 1080;
    const h = op.format === 'Feed' ? 1080 : 1920;
    const x = startX + col * (w + GAP_X);
    const y = row * (h + GAP_Y);

    const result = await cloneAndPopulate(op.templateName, op.frameName, op.overrides, x, y);

    if (result) {
      results.push(result);
    } else {
      errors.push(`"${op.templateName}" not found → ${op.parsed.codigo}`);
    }

    if ((i + 1) % 5 === 0 || i === operations.length - 1) {
      postToUI({
        type: 'BRIDGE_PROGRESS',
        step: 'clone',
        message: `${i + 1}/${operations.length} frames`,
      });
    }
  }

  return {
    dryRun: false,
    presets,
    issueCount: issues.length,
    created: results.length,
    errors,
    createdNodeIds: results.map((r) => r.id),
  };
}

// ---------------------------------------------------------------------------
// 9. Storage
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
