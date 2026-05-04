import { toPng, toSvg } from 'html-to-image';
import { safeFileName } from '../../brand-shared-config';

export type ExportFormat = 'png' | 'svg' | 'html';

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadString(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}

function inlineAllStyles(node: Element): void {
  const styles = window.getComputedStyle(node);
  const important = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
    'color', 'background', 'background-color', 'border', 'border-radius', 'padding', 'margin',
    'display', 'flex-direction', 'align-items', 'justify-content', 'gap', 'width', 'height',
    'max-width', 'min-width', 'opacity', 'text-transform', 'position', 'top', 'left', 'right',
    'bottom', 'inset', 'overflow', 'aspect-ratio', 'box-shadow'];
  const css = important
    .map(p => `${p}:${styles.getPropertyValue(p)}`)
    .filter(s => !s.endsWith(':'))
    .join(';');
  (node as HTMLElement).style.cssText = css;
  Array.from(node.children).forEach(inlineAllStyles);
}

const EXPORT_TIMEOUT_MS = 15_000;

export async function exportMockElement(
  el: HTMLElement,
  brandName: string,
  formatId: string,
  format: ExportFormat,
): Promise<void> {
  if (!el || el.offsetWidth === 0) {
    throw new Error('Element is not visible');
  }

  const base = `${safeFileName(brandName) || 'brand'}-${formatId}`;
  const pixelRatio = (formatId === 'website' || formatId === 'poster') ? 1.5 : 2;

  const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Export timed out')), EXPORT_TIMEOUT_MS)
      ),
    ]);

  switch (format) {
    case 'png': {
      const dataUrl = await withTimeout(toPng(el, { pixelRatio, cacheBust: true }));
      downloadDataUrl(dataUrl, `${base}.png`);
      break;
    }
    case 'svg': {
      const dataUrl = await withTimeout(toSvg(el, { cacheBust: true }));
      downloadDataUrl(dataUrl, `${base}.svg`);
      break;
    }
    case 'html': {
      const clone = el.cloneNode(true) as HTMLElement;
      inlineAllStyles(clone);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${brandName} — ${formatId}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0a;padding:20px}
</style>
</head>
<body>
${clone.outerHTML}
</body>
</html>`;
      downloadString(html, `${base}.html`, 'text/html');
      break;
    }
  }
}

export const EXPORT_FORMATS: Array<{ id: ExportFormat; label: string }> = [
  { id: 'png',  label: 'PNG' },
  { id: 'svg',  label: 'SVG' },
  { id: 'html', label: 'HTML' },
];
