const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'manifest.json');
const outputPath = path.join(__dirname, '..', 'manifest.dev.json');
const pluginDir = path.join(__dirname, '..');

const url = process.env.NGROK_URL;
if (!url) {
  console.error('Set NGROK_URL env var (e.g. NGROK_URL=https://xxx.ngrok-free.app)');
  process.exit(1);
}

const uiUrl = `${url.replace(/\/$/, '')}/plugin`;
const hostname = new URL(url).hostname;

// Create ui-dev.html that redirects to ngrok
fs.writeFileSync(
  path.join(pluginDir, 'ui-dev.html'),
  `<script>window.location.href = "${uiUrl}";</script>`
);

// Update manifest for dev
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.ui = 'ui-dev.html';
manifest.networkAccess.allowedDomains = [hostname, ...(manifest.networkAccess.allowedDomains || [])];
if (!manifest.networkAccess.devAllowedDomains) {
  manifest.networkAccess.devAllowedDomains = [];
}
manifest.networkAccess.devAllowedDomains.push(url.replace(/\/$/, ''));
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log('manifest.dev.json and ui-dev.html generated — import manifest.dev.json in Figma Desktop (Plugins → Development → Import manifest)');
