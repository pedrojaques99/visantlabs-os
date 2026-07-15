/// <reference types="@figma/plugin-typings" />
import type { ExportedNodeImage } from '@shared/protocol';

const MIME: Record<'PNG' | 'JPG', string> = {
  PNG: 'image/png',
  JPG: 'image/jpeg',
};

/** Figma caps export scale at 4x; anything above just wastes bytes. */
function clampScale(scale?: number): number {
  if (!Number.isFinite(scale as number)) return 2;
  return Math.min(4, Math.max(0.1, scale as number));
}

/**
 * Export several nodes to base64 in one round-trip.
 *
 * The legacy `EXPORT_NODE_IMAGE` message handles a single node and replies by message
 * type, so N nodes would mean N racing round-trips with no way to tell the replies
 * apart. This is the batch equivalent on the Envelope protocol.
 *
 * A node that fails to export yields an entry carrying `error` instead of `data` —
 * one bad layer must not sink the whole selection. Callers filter on `data`.
 */
export async function exportNodes(payload: {
  nodeIds?: string[];
  format?: 'PNG' | 'JPG';
  scale?: number;
}): Promise<{ images: ExportedNodeImage[] }> {
  const format = payload.format === 'JPG' ? 'JPG' : 'PNG';
  const value = clampScale(payload.scale);

  const ids = payload.nodeIds?.length
    ? payload.nodeIds
    : figma.currentPage.selection.map((n) => n.id);

  const images: ExportedNodeImage[] = [];

  for (const nodeId of ids) {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || !('exportAsync' in node)) {
        images.push({
          nodeId,
          name: node?.name ?? nodeId,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          error: 'Not exportable',
        });
        continue;
      }

      const scene = node as SceneNode;
      const bytes = await scene.exportAsync({ format, constraint: { type: 'SCALE', value } });

      images.push({
        nodeId,
        name: scene.name,
        data: `data:${MIME[format]};base64,${figma.base64Encode(bytes)}`,
        width: Math.round(scene.width * value),
        height: Math.round(scene.height * value),
        x: scene.x,
        y: scene.y,
      });
    } catch (e: any) {
      images.push({
        nodeId,
        name: nodeId,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        error: e?.message || 'Export failed',
      });
    }
  }

  return { images };
}
