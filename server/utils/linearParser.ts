/**
 * Linear Issue Parser
 * Transforms Linear "Copy as prompt" format into structured data for Figma operations
 */

export interface LinearIssue {
  identifier: string;
  title: string;
  description: string;
  team?: string;
  labels?: string[];
  project?: {
    name: string;
    description?: string;
  };
  // Extracted from description
  cliente?: string;
  contexto?: string;
  formato?: {
    tipo: string;
    dimensoes?: { width: number; height: number }[];
  };
  textos?: Record<string, string>;
  etapas?: string[];
  observacoes?: string[];
  prazo?: string;
}

/**
 * Parse Linear XML-like format into structured data
 */
export function parseLinearIssue(prompt: string): LinearIssue | null {
  // Check if it's a Linear issue format
  const issueMatch = prompt.match(/<issue\s+identifier="([^"]+)">/);
  if (!issueMatch) return null;

  const identifier = issueMatch[1];

  // Extract basic fields
  const title = extractTag(prompt, 'title') || '';
  const description = extractTag(prompt, 'description') || '';
  const team = extractAttribute(prompt, 'team', 'name');
  const projectName = extractAttribute(prompt, 'project', 'name');
  const projectDesc = extractTag(prompt, 'project');
  const labels = extractAllAttributes(prompt, 'label');

  // Parse description sections
  const sections = parseDescriptionSections(description);

  // Extract formato/dimensões
  const formato = parseFormato(description);

  return {
    identifier,
    title,
    description,
    team,
    labels,
    project: projectName ? { name: projectName, description: projectDesc } : undefined,
    cliente: sections['cliente'] || sections['client'],
    contexto: sections['contexto'] || sections['context'],
    formato,
    textos: extractTextos(description),
    etapas: extractList(sections['etapas'] || sections['steps'] || ''),
    observacoes: extractList(sections['observacoes'] || sections['observações'] || sections['notes'] || ''),
    prazo: extractPrazo(description),
  };
}

function extractTag(text: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : undefined;
}

function extractAttribute(text: string, tag: string, attr: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = text.match(regex);
  return match ? match[1] : undefined;
}

function extractAllAttributes(text: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function parseDescriptionSections(description: string): Record<string, string> {
  const sections: Record<string, string> = {};

  // Match ## Section headers
  const sectionRegex = /##\s*([^\n]+)\n([\s\S]*?)(?=##\s|$)/g;
  let match;

  while ((match = sectionRegex.exec(description)) !== null) {
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    sections[key] = match[2].trim();
  }

  return sections;
}

function parseFormato(description: string): LinearIssue['formato'] | undefined {
  // Look for dimension patterns like 1080x1920px, 1080x1080
  const dimRegex = /(\d+)\s*x\s*(\d+)\s*(?:px)?/gi;
  const dimensoes: { width: number; height: number }[] = [];
  let match;

  while ((match = dimRegex.exec(description)) !== null) {
    dimensoes.push({
      width: parseInt(match[1]),
      height: parseInt(match[2]),
    });
  }

  if (dimensoes.length === 0) return undefined;

  // Determine tipo based on dimensions
  let tipo = 'custom';
  if (dimensoes.some(d => d.width === 1080 && d.height === 1920)) tipo = 'stories';
  else if (dimensoes.some(d => d.width === 1080 && d.height === 1080)) tipo = 'feed';
  else if (dimensoes.some(d => d.width === 1080 && d.height === 1350)) tipo = 'feed-portrait';

  return { tipo, dimensoes };
}

function extractTextos(description: string): Record<string, string> {
  const textos: Record<string, string> = {};

  // Match **Label:** or **Label** followed by content
  const boldRegex = /\*\*([^*]+)\*\*:?\s*([^\n*]+(?:\n(?!\*\*)[^\n*]+)*)/g;
  let match;

  while ((match = boldRegex.exec(description)) !== null) {
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();
    if (value && !['etapas', 'observacoes', 'formato'].includes(key)) {
      textos[key] = value;
    }
  }

  return textos;
}

function extractList(text: string): string[] {
  if (!text) return [];

  // Match numbered or bulleted lists
  const items = text.split(/\n/).filter(line => {
    const trimmed = line.trim();
    return trimmed.match(/^[\d\.\-\*]\s/) || trimmed.match(/^\d+\./);
  });

  return items.map(item => item.replace(/^[\d\.\-\*]\s*/, '').trim());
}

function extractPrazo(description: string): string | undefined {
  // Look for date patterns
  const prazoMatch = description.match(/(?:prazo|deadline|entregar?\s*(?:ate|até)?)[:\s]*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (prazoMatch) return prazoMatch[1];

  const dateMatch = description.match(/ate\s*(?:o\s*dia\s*)?(\d{1,2}\/\d{1,2})/i);
  if (dateMatch) return dateMatch[1];

  return undefined;
}

/**
 * Generate optimized prompt for Figma plugin from parsed Linear issue
 */
export function linearIssueToFigmaPrompt(issue: LinearIssue): string {
  const lines: string[] = [];

  lines.push(`Criar página "${issue.identifier}" para: ${issue.title}`);
  lines.push('');

  if (issue.cliente) {
    lines.push(`Cliente: ${issue.cliente}`);
  }

  if (issue.formato?.dimensoes?.length) {
    lines.push('');
    lines.push('Formatos (IMPORTANTE: nome do frame DEVE incluir dimensões):');
    for (const dim of issue.formato.dimensoes) {
      const tipo = dim.height > dim.width ? 'Stories' : dim.width === dim.height ? 'Feed' : 'Banner';
      lines.push(`- Frame "${tipo} ${dim.width}x${dim.height}": ${dim.width}x${dim.height}px`);
    }
  }

  if (Object.keys(issue.textos || {}).length > 0) {
    lines.push('');
    lines.push('Conteúdo:');
    for (const [key, value] of Object.entries(issue.textos!)) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      lines.push(`- ${label}: "${value.slice(0, 100)}${value.length > 100 ? '...' : ''}"`);
    }
  }

  if (issue.observacoes?.length) {
    lines.push('');
    lines.push('Estilo: ' + issue.observacoes.join(', '));
  }

  return lines.join('\n');
}

/**
 * Check if prompt is a Linear issue and transform if needed
 */
export function preprocessPrompt(prompt: string): {
  originalPrompt: string;
  processedPrompt: string;
  linearIssue?: LinearIssue;
  isLinearIssue: boolean;
} {
  const issue = parseLinearIssue(prompt);

  if (issue) {
    return {
      originalPrompt: prompt,
      processedPrompt: linearIssueToFigmaPrompt(issue),
      linearIssue: issue,
      isLinearIssue: true,
    };
  }

  return {
    originalPrompt: prompt,
    processedPrompt: prompt,
    isLinearIssue: false,
  };
}
