import type Konva from 'konva';
import { waitForStageImages } from './waitForImages';
import { withIdentityViewport } from './stageCapture';

/**
 * Captures the current creative Stage as a small PNG data URL suitable for
 * project thumbnails. Uses pixelRatio = min(1, maxWidth / stage.width()) so
 * the thumbnail is at most `maxWidth` pixels wide while still being a
 * fresh Konva render (not a downscaled preview).
 *
 * Forces identity viewport during capture so the thumbnail reflects the
 * full creative even if the user is currently zoomed/panned.
 */
export async function captureCanvasThumbnail(
  stage: Konva.Stage | null,
  maxWidth = 480
): Promise<string | null> {
  try {
    if (!stage) return null;
    const previewWidth = stage.width();
    if (!previewWidth) return null;
    const pixelRatio = Math.min(1, maxWidth / previewWidth);
    await waitForStageImages(stage);
    return await withIdentityViewport(stage, () =>
      stage.toDataURL({ pixelRatio, mimeType: 'image/png' })
    );
  } catch (err) {
    console.warn('[captureCanvasThumbnail] failed:', err);
    return null;
  }
}
