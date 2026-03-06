import type { Node, Edge } from '@xyflow/react';

export const VISANT_CANVAS_SCHEMA = 'visant-canvas/v1';

export interface VisantCanvasExport {
  meta: {
    schema: string;
    exportedAt: string;
    nodeCount: number;
    edgeCount: number;
    drawingCount: number;
  };
  name: string;
  nodes: Node[];
  edges: Edge[];
  drawings: any[];
}

/**
 * Top-level node data fields that are either too large to serialize or are
 * transient (recomputed from edges when the canvas loads). Stripped on export.
 */
const STRIP_FIELDS = new Set([
  // Large binary data — keep only R2 URLs
  'resultImageBase64',
  'resultImageBase64Timestamp',
  'resultVideoBase64',
  'imageBase64',
  'base64',
  'base64Timestamp',
  'pdfBase64',
  'pdfBase64Timestamp',
  'identityPdfBase64',
  'identityPdfBase64Timestamp',
  'identityImageBase64',
  'logoBase64',
  'uploadedVideo',
  'startFrame',
  'endFrame',
  // Transient edge-synced fields (recomputed from edges on load)
  'connectedImages',
  'connectedImage',
  'connectedImage1',
  'connectedImage2',
  'connectedImage3',
  'connectedImage4',
  'connectedLogo',
  'connectedPdf',
  'connectedIdentity',
  'connectedText',
  'connectedStrategyData',
  'connectedBrandIdentity',
  'connectedVideo',
  // Transient UI state
  'oversizedWarning',
  'isGenerating',
  'isLoading',
  'isAnalyzing',
  'isDescribing',
  'isGeneratingPrompt',
  'promptSuggestions',
  'isSuggestingPrompts',
  'suggestedTags',
  'suggestedBrandingTags',
  'suggestedCategoryTags',
  'suggestedLocationTags',
  'suggestedAngleTags',
  'suggestedLightingTags',
  'suggestedEffectTags',
  'suggestedMaterialTags',
  'userMockups',
  'savedMockupId',
]);

/**
 * Recursively clean a node data object:
 * - Removes functions (React callbacks — never serializable)
 * - Removes fields in STRIP_FIELDS at any nesting level
 */
function cleanNodeData(data: unknown, depth = 0): unknown {
  if (depth > 6) return data; // guard against circular refs
  if (data === null || data === undefined) return data;
  if (typeof data === 'function') return undefined;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data
      .map((item) => cleanNodeData(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === 'function') continue;
    if (STRIP_FIELDS.has(key)) continue;
    const cleanedValue = cleanNodeData(value, depth + 1);
    if (cleanedValue !== undefined) {
      cleaned[key] = cleanedValue;
    }
  }
  return cleaned;
}

/**
 * Serialize the current canvas state to a VisantCanvasExport object.
 * Safe to call at any time — never throws.
 */
export function exportCanvasToJson(
  name: string,
  nodes: Node[],
  edges: Edge[],
  drawings: any[] = []
): VisantCanvasExport {
  const cleanedNodes = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    ...(node.width !== undefined ? { width: node.width } : {}),
    ...(node.height !== undefined ? { height: node.height } : {}),
    ...(node.measured !== undefined ? { measured: node.measured } : {}),
    data: cleanNodeData(node.data) ?? {},
  })) as Node[];

  const cleanedEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
    ...(edge.type ? { type: edge.type } : {}),
  })) as Edge[];

  return {
    meta: {
      schema: VISANT_CANVAS_SCHEMA,
      exportedAt: new Date().toISOString(),
      nodeCount: cleanedNodes.length,
      edgeCount: cleanedEdges.length,
      drawingCount: drawings.length,
    },
    name: name || 'Untitled',
    nodes: cleanedNodes,
    edges: cleanedEdges,
    drawings,
  };
}

/** Trigger a browser download of the JSON file. */
export function downloadJsonFile(data: VisantCanvasExport, baseName: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (baseName || 'canvas').replace(/[^a-z0-9\-_]/gi, '_');
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Returns true if the parsed JSON looks like a valid Visant canvas export. */
export function validateVisantJson(data: unknown): data is VisantCanvasExport {
  if (!data || typeof data !== 'object') return false;
  const d = data as any;
  if (!d.meta || d.meta.schema !== VISANT_CANVAS_SCHEMA) return false;
  if (!Array.isArray(d.nodes)) return false;
  if (!Array.isArray(d.edges)) return false;
  return true;
}

/** Read and parse a JSON File from a file input. Rejects on parse error. */
export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target?.result as string));
      } catch {
        reject(new Error('Invalid JSON file — could not parse.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}
