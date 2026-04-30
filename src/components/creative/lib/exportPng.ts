import { saveAs } from 'file-saver';
import type Konva from 'konva';
import { FORMAT_DIMENSIONS } from './formatDimensions';
import { waitForStageImages } from './waitForImages';
import { withIdentityViewport } from './stageCapture';
import type { CreativeFormat } from '../store/creativeTypes';

/**
 * Exports a Konva Stage as a PNG at the format's native resolution.
 *
 * The Stage is rendered at preview size during editing (e.g. 540x540 for a 1:1).
 * Konva re-rasterizes all vector nodes at the higher resolution via
 * `pixelRatio = targetWidth / previewWidth` — no quality loss vs. the old
 * dom-to-image scale-transform approach.
 *
 * Viewport zoom/pan is temporarily reset to identity so the captured image
 * always reflects the full creative, regardless of how the user zoomed.
 */
export async function exportCanvasAsPng(
  stage: Konva.Stage | null,
  format: CreativeFormat,
  filename = 'creative.png'
): Promise<void> {
  if (!stage) throw new Error('Stage not mounted');

  const target = FORMAT_DIMENSIONS[format];
  const previewWidth = stage.width();
  if (!previewWidth) throw new Error('Stage has zero width');

  const pixelRatio = target.width / previewWidth;
  await waitForStageImages(stage);
  const dataUrl = await withIdentityViewport(stage, () =>
    stage.toDataURL({ pixelRatio, mimeType: 'image/png' })
  );

  // Convert dataURL -> Blob for file-saver (RESEARCH.md Pattern 5)
  const blob = await (await fetch(dataUrl)).blob();
  if (!blob) throw new Error('Export failed: empty blob');
  saveAs(blob, filename);
}
