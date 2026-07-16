import { apiUrl } from '../config';

/**
 * Hand a file to the user from inside the plugin iframe.
 *
 * `URL.createObjectURL` + a synthetic anchor click is the only delivery route Figma
 * gives us — the Plugin API has no "save file" surface. Accepts a Blob so binary
 * (a rendered video) works as well as text.
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType = 'text/markdown'
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Fetch a URL and hand the bytes to the user as a download.
 *
 * Goes through the backend proxy instead of fetching the URL directly. R2's public
 * bucket sends no CORS headers and the plugin iframe is a null origin, so a direct
 * fetch is blocked by the browser even though the object itself serves fine (200).
 * The proxy adds `Access-Control-Allow-Origin` plus an attachment disposition, which
 * R2 objects lack — without it the video would open in a tab instead of saving.
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const proxied = apiUrl(
    `/images/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  );
  const res = await fetch(proxied);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  downloadFile(await res.blob(), filename);
}
