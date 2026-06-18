/**
 * Prerender the legal pages (/terms, /privacy) to static HTML.
 *
 * Why: those routes are part of the React SPA, so without JS they render an
 * empty shell. Crawlers, link-preview bots, no-JS clients, and the ChatGPT app
 * directory's link checks need the real content. This emits static
 * dist/<route>/index.html files which Vercel serves directly (the catch-all
 * SPA rewrite in vercel.json only fires for paths with no matching file), while
 * browsers still boot the SPA on top (createRoot, not hydrate — no mismatch).
 *
 * How: an isolated Vite SSR build of scripts/prerender-legal.entry.tsx renders
 * the real page components to static markup, injected into the built SPA shell.
 * The SSR build uses its own minimal config and never touches the production
 * vite.config chunking (which is intentionally fragile — see vite.config.ts).
 *
 * Runs automatically after `npm run build` via the "postbuild" script.
 */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Force a deterministic locale for the static fallback. The page components
// resolve locale from navigator.language / timezone at render time, so on a
// pt-BR build machine they would bake Portuguese into the file. The static
// fallback is for crawlers / the ChatGPT directory's link checks (English,
// global), so we pin en-US regardless of where the build runs. Real visitors
// still get their own locale — the SPA re-renders on top (createRoot).
process.env.TZ = 'UTC';
try {
  Object.defineProperty(globalThis.navigator, 'language', { value: 'en-US', configurable: true });
} catch {
  /* navigator not present / not overridable — getUserLocale falls back to en-US */
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const ssrOutDir = path.join(root, 'node_modules', '.cache', 'prerender-legal');
const entry = path.join(root, 'scripts', 'prerender-legal.entry.tsx');

const FALLBACK_TEMPLATE =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"/>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
  '<title>Visant Labs®</title></head><body><div id="root"></div></body></html>';

async function main() {
  // 1. Bundle the two legal pages for SSR (isolated config).
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    resolve: { alias: { '@': path.join(root, 'src') } },
    plugins: [react()],
    build: {
      ssr: entry,
      outDir: ssrOutDir,
      emptyOutDir: true,
      target: 'es2022',
      rollupOptions: { output: { format: 'es', entryFileNames: 'entry.mjs' } },
    },
  });

  const { render, ROUTES } = await import(
    pathToFileURL(path.join(ssrOutDir, 'entry.mjs')).href
  );

  // 2. Use the built SPA shell as the template (keeps CSS/JS/meta). Fall back to
  //    a minimal doc if dist/index.html is missing (e.g. running standalone).
  const templatePath = path.join(distDir, 'index.html');
  const template = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf8')
    : FALLBACK_TEMPLATE;
  if (!fs.existsSync(templatePath)) {
    console.warn('[prerender-legal] dist/index.html not found — using minimal fallback template');
  }

  // 3. Inject static markup + per-page <title> for each legal route.
  for (const { route, title } of ROUTES) {
    const body = render(route);
    let html = template.replace(/<div id="root">\s*<\/div>/, `<div id="root">${body}</div>`);
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
    const outDir = path.join(distDir, route.replace(/^\//, ''));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    console.log(
      `[prerender-legal] ${route} -> dist${route}/index.html (${body.length} bytes of static markup)`
    );
  }
}

main().catch((err) => {
  console.error('[prerender-legal] failed:', err);
  process.exit(1);
});
