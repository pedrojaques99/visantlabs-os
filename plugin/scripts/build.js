const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const pluginDir = path.join(__dirname, '..');
const srcDir = path.join(pluginDir, 'src');
const distDir = path.join(pluginDir, 'dist');
const modulesDir = path.join(pluginDir, 'modules');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// ── Read source files ──────────────────────────────────────────────────────────
const htmlTemplate = fs.readFileSync(path.join(pluginDir, 'ui.html'), 'utf-8');
const cssContent = fs.readFileSync(path.join(pluginDir, 'ui.css'), 'utf-8');

// Concatenate JS modules in the required load order (must match ui.html)
const moduleFiles = [
  'EventEmitter.js',
  'state.js',
  'utils.js',
  'mentions.js',
  'api.js',
  'designSystem.js',
  'brandSync.js',
  'chat.js',
  'brand/brandColors.js',
  'brand/brandModals.js',
  'brand.js',
  'brandIntelligence.js',
  'library.js',
  'uiManager.js',
];
const jsParts = moduleFiles.map(f =>
  `// ── ${f} ──\n` + fs.readFileSync(path.join(modulesDir, f), 'utf-8')
);
// Entry-point (ui-refactored.js lives at the plugin root)
jsParts.push(
  `// ── ui-refactored.js ──\n` +
  fs.readFileSync(path.join(pluginDir, 'ui-refactored.js'), 'utf-8')
);
const jsContent = jsParts.join('\n\n');

// ── Assemble self-contained HTML ───────────────────────────────────────────────
// 1. Replace <link rel="stylesheet" ...> with inlined <style>
// 2. Remove all individual <script src="..."> tags
// 3. Append a single bundled <script> before </body>
let htmlContent = htmlTemplate
  // Inline CSS
  .replace(/<link\s+rel="stylesheet"\s+href="[^"]*"\s*\/?>/gi,
    `<style>\n${cssContent}\n</style>`)
  // Remove all external script tags (modules + entry point)
  .replace(/<script\s+src="[^"]*"><\/script>\s*/gi, '')
  // Inject bundled JS just before </body>
  .replace('</body>', `  <script>\n${jsContent}\n  </script>\n</body>`);

// ── esbuild plugin: inject assembled HTML into code.ts ────────────────────────
const htmlPlugin = {
  name: 'html-inject',
  setup(build) {
    build.onLoad({ filter: /code\.ts$/ }, async (args) => {
      let code = await fs.promises.readFile(args.path, 'utf-8');
      code = code.replace(/__html__/g, JSON.stringify(htmlContent));
      return { contents: code, loader: 'ts' };
    });
  }
};

// ── Build code.ts → dist/code.js ─────────────────────────────────────────────
esbuild.build({
  entryPoints: [path.join(srcDir, 'code.ts')],
  bundle: true,
  outfile: path.join(distDir, 'code.js'),
  target: 'es2017',
  loader: { '.ts': 'ts' },
  plugins: [htmlPlugin],
}).then(() => {
  console.log('✅  Build complete → dist/code.js');
}).catch((err) => {
  console.error('❌  Build failed:', err);
  process.exit(1);
});
