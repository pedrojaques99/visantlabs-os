import domtoimage from 'dom-to-image-more';

/**
 * Captures the current creative canvas as a small PNG data URL suitable for
 * project thumbnails. Separate from exportCanvasAsPng (which saves at native
 * resolution) — this keeps thumbnails light and avoids re-rendering at 4K.
 */
export async function captureCanvasThumbnail(
  node: HTMLElement,
  maxWidth = 480
): Promise<string | null> {
  try {
    const scale = Math.min(1, maxWidth / node.offsetWidth);
    const dataUrl = await domtoimage.toPng(node, {
      width: node.offsetWidth * scale,
      height: node.offsetHeight * scale,
      style: {
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: `${node.offsetWidth}px`,
        height: `${node.offsetHeight}px`,
      },
      cacheBust: true,
      quality: 0.85,
    });
    return dataUrl;
  } catch (err) {
    console.warn('[captureCanvasThumbnail] failed:', err);
    return null;
  }
}
