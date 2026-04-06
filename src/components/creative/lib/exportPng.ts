import domtoimage from 'dom-to-image-more';
import { saveAs } from 'file-saver';
import { FORMAT_DIMENSIONS } from './formatDimensions';
import type { CreativeFormat } from '../store/creativeTypes';

/**
 * Exports a creative canvas DOM node as a PNG at native format resolution.
 * The node must already be sized to the preview dimensions; we apply a
 * scale transform during capture to render at FORMAT_DIMENSIONS resolution.
 */
export async function exportCanvasAsPng(
  node: HTMLElement,
  format: CreativeFormat,
  filename = 'creative.png'
): Promise<void> {
  const target = FORMAT_DIMENSIONS[format];
  const previewWidth = node.offsetWidth;
  const scale = target.width / previewWidth;

  const blob = await domtoimage.toBlob(node, {
    width: target.width,
    height: target.height,
    style: {
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      width: `${previewWidth}px`,
      height: `${node.offsetHeight}px`,
    },
    cacheBust: true,
  });

  if (!blob) throw new Error('Export failed: no blob produced');
  saveAs(blob, filename);
}
