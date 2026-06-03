import striptags from 'striptags';

export function stripHtml(value: string | undefined | null): string {
  if (!value) return '';
  return striptags(value).replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export async function stripHtmlFull(html: string): Promise<string> {
  if (!html) return '';
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  doc.querySelectorAll('script, style').forEach(el => el.remove());
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}
