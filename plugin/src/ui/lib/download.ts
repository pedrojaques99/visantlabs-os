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
 * Used for R2-hosted renders: navigating to the URL directly would open the video in
 * a browser tab instead of saving it, and R2 objects carry no attachment disposition.
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  downloadFile(await res.blob(), filename);
}
