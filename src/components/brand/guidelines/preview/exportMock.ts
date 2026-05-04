import { toPng, toSvg } from 'html-to-image';
import { safeFileName } from '../../brand-shared-config';

export type ExportFormat = 'png' | 'svg' | 'html';

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}

export async function exportMockElement(
  el: HTMLElement,
  brandName: string,
  formatId: string,
  format: ExportFormat,
): Promise<void> {
  const base = `${safeFileName(brandName)}-${formatId}`;

  switch (format) {
    case 'png': {
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
      downloadDataUrl(dataUrl, `${base}.png`);
      break;
    }
    case 'svg': {
      const dataUrl = await toSvg(el, { cacheBust: true });
      downloadDataUrl(dataUrl, `${base}.svg`);
      break;
    }
    case 'html': {
      const clone = el.cloneNode(true) as HTMLElement;
      const styles = window.getComputedStyle(el);
      const cssText = Array.from(styles).reduce((acc, prop) => {
        return `${acc}${prop}:${styles.getPropertyValue(prop)};`;
      }, '');
      clone.setAttribute('style', cssText);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${brandName} — ${formatId}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0a}
</style>
</head>
<body>
${el.outerHTML}
</body>
</html>`;
      downloadBlob(html, `${base}.html`, 'text/html');
      break;
    }
  }
}

export const EXPORT_FORMATS: Array<{ id: ExportFormat; label: string }> = [
  { id: 'png',  label: 'PNG' },
  { id: 'svg',  label: 'SVG' },
  { id: 'html', label: 'HTML' },
];
