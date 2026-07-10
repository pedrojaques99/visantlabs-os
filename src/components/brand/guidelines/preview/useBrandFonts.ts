import { useEffect } from 'react';

/**
 * Injects the brand's heading/body web fonts (Google Fonts) into <head> so previews
 * render in the ACTUAL brand typography instead of a system fallback. Shared by the
 * public preview gallery and the admin PreviewSection — without this, `headingFamily`
 * like `'Unbounded'` silently falls back to Arial. Idempotent (one shared <link>).
 */
export function useBrandFonts(headingFamily?: string, bodyFamily?: string): void {
  useEffect(() => {
    const families = [headingFamily, bodyFamily]
      .map((stack) => stack?.match(/^'([^']+)'/)?.[1])
      .filter((f): f is string => !!f && f !== 'Inter');
    const unique = [...new Set(families)];
    if (!unique.length) return;

    const id = 'brand-preview-fonts';
    const href = `https://fonts.googleapis.com/css2?${unique
      .map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`)
      .join('&')}&display=swap`;

    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (link) {
      if (link.href !== href) link.href = href;
    } else {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }, [headingFamily, bodyFamily]);
}
