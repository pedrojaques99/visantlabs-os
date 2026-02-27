const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');
const uiPath = path.join(__dirname, '..', 'ui.html');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Read UI HTML
const htmlContent = fs.readFileSync(uiPath, 'utf-8');

// Create a plugin that injects HTML as __html__
const htmlPlugin = {
  name: 'html-inject',
  setup(build) {
    build.onLoad({ filter: /code\.ts$/ }, async (args) => {
      let code = await fs.promises.readFile(args.path, 'utf-8');

      // Replace __html__ with the actual HTML content (escaped)
      const htmlEscaped = JSON.stringify(htmlContent);
      code = code.replace(/__html__/g, htmlEscaped);

      return { contents: code, loader: 'ts' };
    });
  }
};

esbuild.build({
  entryPoints: [path.join(srcDir, 'code.ts')],
  bundle: true,
  outfile: path.join(distDir, 'code.js'),
  target: 'es2020',
  loader: { '.ts': 'ts' },
  plugins: [htmlPlugin],
}).catch(() => process.exit(1));
