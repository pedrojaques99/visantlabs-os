const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');
const uiPath = path.join(__dirname, '..', 'ui.html');
const cssPath = path.join(__dirname, '..', 'ui.css');
const jsPath = path.join(__dirname, '..', 'ui.js');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

// Read source files
const htmlTemplate = fs.readFileSync(uiPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');
const jsContent = fs.readFileSync(jsPath, 'utf-8');

// Inline CSS and JS into the HTML template
let htmlContent = htmlTemplate
  .replace('<link rel="stylesheet" href="./ui.css">', `<style>\n${cssContent}\n</style>`)
  .replace('<script src="./ui.js"></script>', `<script>\n${jsContent}\n</script>`);

// Plugin that injects the assembled HTML as __html__
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

esbuild.build({
  entryPoints: [path.join(srcDir, 'code.ts')],
  bundle: true,
  outfile: path.join(distDir, 'code.js'),
  target: 'es2017',
  loader: { '.ts': 'ts' },
  plugins: [htmlPlugin],
}).catch(() => process.exit(1));

