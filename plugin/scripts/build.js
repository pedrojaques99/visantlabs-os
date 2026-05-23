const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

require('./check-icons');

const ROOT = path.resolve(__dirname, '../..');
const pluginDir = path.resolve(__dirname, '..');
const distDir = path.join(pluginDir, 'dist');
const isDev = process.env.NODE_ENV === 'development';

// Ensure dist directory exists
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

async function build() {
  try {
    console.log('🔨 Step 1: Building UI React bundle...');

    // Step 1: Bundle UI React components into IIFE
    await esbuild.build({
      entryPoints: [path.join(pluginDir, 'src/ui/main.tsx')],
      bundle: true,
      outfile: path.join(distDir, 'ui-bundle.js'),
      format: 'iife',
      target: 'es2020',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.svg': 'dataurl'
      },
      jsx: 'automatic',
      jsxImportSource: 'react',
      absWorkingDir: ROOT,
      alias: {
        '@': path.join(ROOT, 'src'),
        '@shared': path.join(ROOT, 'shared')
      },
      minify: !isDev,
      sourcemap: isDev,
      define: {
        'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
        'import.meta.env': JSON.stringify({}),
        'import.meta': JSON.stringify({ env: {} }),
      },
      external: [],
      logLevel: 'info'
    });

    console.log('✅ UI bundle created');

    console.log('🎨 Step 2: Generating Tailwind CSS...');

    // Step 2: Generate CSS via Tailwind CLI
    try {
      execSync(
        `npx @tailwindcss/cli -i "${path.join(pluginDir, 'tailwind-plugin.css')}" -o "${path.join(distDir, 'ui-bundle.css')}"`,
        { cwd: ROOT, stdio: 'inherit' }
      );
      console.log('✅ Tailwind CSS generated');
    } catch (err) {
      console.error('⚠️  Tailwind CLI failed, using fallback CSS...');
      // Fallback: create minimal CSS with tokens
      const baseCSS = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf-8');
      fs.writeFileSync(
        path.join(distDir, 'ui-bundle.css'),
        baseCSS + '\n/* Tailwind CLI did not run, using base CSS only */'
      );
    }

    console.log('📦 Step 3: Assembling HTML...');

    // Step 3: Read generated files
    const jsContent = fs.readFileSync(path.join(distDir, 'ui-bundle.js'), 'utf-8');
    const cssContent = fs.readFileSync(path.join(distDir, 'ui-bundle.css'), 'utf-8');

    // Step 3: Assemble self-contained HTML
    const htmlContent = `<!DOCTYPE html>
<html class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${cssContent}

/* Reset for Figma iframe */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-user-select: text;
  user-select: text;
}

#root {
  width: 100%;
  height: 100%;
}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // Figma data: URL polyfill — must run before ANY other script
    (function(){
      try { var x = window.localStorage; x.getItem('_'); return; } catch(e) {}
      var s = {};
      var mem = {
        get length(){ return Object.keys(s).length; },
        key: function(i){ return Object.keys(s)[i] || null; },
        getItem: function(k){ return s.hasOwnProperty(k) ? s[k] : null; },
        setItem: function(k,v){ s[k] = String(v); },
        removeItem: function(k){ delete s[k]; },
        clear: function(){ s = {}; }
      };
      try { Object.defineProperty(window, 'localStorage', { value: mem, writable: true, configurable: true }); } catch(e) { window.localStorage = mem; }
      try { Object.defineProperty(window, 'sessionStorage', { value: mem, writable: true, configurable: true }); } catch(e) { window.sessionStorage = mem; }
    })();
    window.__VISANT_API_URL__ = '${process.env.VISANT_API_URL || 'https://api.visantlabs.com'}';
  </script>
  <script>
${jsContent}
  </script>
</body>
</html>`;

    console.log('✅ HTML assembled');

    console.log('⚙️  Step 4: Building plugin sandbox...');

    // Step 4: HTML injection plugin for esbuild
    const htmlPlugin = {
      name: 'html-inject',
      setup(build) {
        build.onLoad({ filter: /code\.ts$/ }, async (args) => {
          let code = await fs.promises.readFile(args.path, 'utf-8');
          code = code.replace(/__html__/g, () => JSON.stringify(htmlContent));
          return { contents: code, loader: 'ts' };
        });
      }
    };

    // Step 4: Build code.ts (sandbox)
    await esbuild.build({
      entryPoints: [path.join(pluginDir, 'src/code.ts')],
      bundle: true,
      outfile: path.join(distDir, 'code.js'),
      format: 'iife',
      target: 'es2017',
      loader: { '.ts': 'ts' },
      minify: !isDev,
      sourcemap: isDev,
      plugins: [htmlPlugin],
      alias: {
        '@shared': path.join(ROOT, 'shared')
      },
      external: [],
      logLevel: 'info'
    });

    // Post-build: sanitize `import(` references that Figma sandbox rejects
    const codeOut = path.join(distDir, 'code.js');
    let bundled = fs.readFileSync(codeOut, 'utf-8');
    bundled = bundled.replace(/import\s*\(/g, 'void(');
    fs.writeFileSync(codeOut, bundled);

    console.log('✅ Sandbox bundled');

    console.log('\n✨ Build complete!');
    console.log(`   📄 dist/code.js — ${(fs.statSync(path.join(distDir, 'code.js')).size / 1024).toFixed(1)}KB`);
    console.log(`   🎨 dist/ui-bundle.css — ${(fs.statSync(path.join(distDir, 'ui-bundle.css')).size / 1024).toFixed(1)}KB`);

  } catch (err) {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
  }
}

build();
