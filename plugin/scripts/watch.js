const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');
const uiPath = path.join(__dirname, '..', 'ui.html');
const cssPath = path.join(__dirname, '..', 'ui.css');
const jsPath = path.join(__dirname, '..', 'ui.js');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

function buildHtml() {
  const html = fs.readFileSync(uiPath, 'utf-8');
  const css = fs.readFileSync(cssPath, 'utf-8');
  const js = fs.readFileSync(jsPath, 'utf-8');
  return html
    .replace('<link rel="stylesheet" href="./ui.css">', `<style>\n${css}\n</style>`)
    .replace('<script src="./ui.js"></script>', `<script>\n${js}\n</script>`);
}

const htmlPlugin = {
  name: 'html-inject',
  setup(build) {
    build.onLoad({ filter: /code\.ts$/ }, async (args) => {
      let code = await fs.promises.readFile(args.path, 'utf-8');
      // Re-read ui files on every rebuild
      code = code.replace(/__html__/g, JSON.stringify(buildHtml()));
      return { contents: code, loader: 'ts' };
    });
  }
};

esbuild.build({
  entryPoints: [path.join(srcDir, 'code.ts')],
  bundle: true,
  outfile: path.join(distDir, 'code.js'),
  target: 'es2017',
  loader: { '.ts': 'ts' },
  watch: true,
  plugins: [htmlPlugin],
}).catch(() => process.exit(1));

