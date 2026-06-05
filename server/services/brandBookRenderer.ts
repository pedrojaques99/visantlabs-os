import puppeteer from 'puppeteer-core';
import { compressPdf } from './ghostscriptService.js';
import { logger } from '../lib/logger.js';

interface BrandBookData {
  identity?: { name?: string; tagline?: string; description?: string; website?: string };
  logos?: Array<{ url: string; variant: string; label?: string }>;
  colors?: Array<{
    hex: string;
    name: string;
    role?: string;
    cmyk?: { c: number; m: number; y: number; k: number };
  }>;
  typography?: Array<{
    family: string;
    style?: string;
    role: string;
    size?: number;
    weights?: number[];
  }>;
  guidelines?: { voice?: string; dos?: string[]; donts?: string[]; imagery?: string };
  strategy?: {
    manifesto?:
      | string
      | { full?: string; provocation?: string; tension?: string; promise?: string };
    pillars?: Array<{ value: string; description: string }>;
    archetypes?: Array<{ name: string; description: string; role?: string }>;
    voiceValues?: Array<{ title: string; description: string; example: string }>;
  };
  gradients?: Array<{ name: string; css?: string }>;
}

interface RenderOptions {
  compress?: boolean;
  preset?: 'screen' | 'ebook' | 'printer' | 'prepress';
}

function buildHtml(brand: BrandBookData): string {
  const name = brand.identity?.name || 'Brand Guidelines';
  const tagline = brand.identity?.tagline || '';
  const description = brand.identity?.description || '';
  const primaryColor = brand.colors?.[0]?.hex || '#00D4FF';

  const logoSection = brand.logos?.length
    ? `<div class="section">
        <h2>Logo</h2>
        <div class="logo-grid">
          ${brand.logos
            .map(
              (l) => `
            <div class="logo-card">
              <img src="${l.url}" alt="${l.variant}" />
              <span class="logo-label">${l.label || l.variant}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>`
    : '';

  const colorSection = brand.colors?.length
    ? `<div class="section page-break">
        <h2>Color Palette</h2>
        <div class="color-grid">
          ${brand.colors
            .map(
              (c) => `
            <div class="color-card">
              <div class="color-swatch" style="background:${c.hex}"></div>
              <div class="color-info">
                <strong>${c.name}</strong>
                <span class="color-hex">${c.hex}</span>
                ${c.role ? `<span class="color-role">${c.role}</span>` : ''}
                ${
                  c.cmyk
                    ? `<span class="color-cmyk">C${c.cmyk.c} M${c.cmyk.m} Y${c.cmyk.y} K${c.cmyk.k}</span>`
                    : ''
                }
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>`
    : '';

  const typoSection = brand.typography?.length
    ? `<div class="section">
        <h2>Typography</h2>
        <div class="typo-grid">
          ${brand.typography
            .map(
              (t) => `
            <div class="typo-card">
              <div class="typo-sample" style="font-family:'${
                t.family
              }',sans-serif;font-size:${Math.min(t.size || 32, 48)}px">Aa</div>
              <div class="typo-info">
                <strong>${t.family}</strong>
                <span class="typo-role">${t.role}${t.style ? ` · ${t.style}` : ''}</span>
                ${
                  t.weights?.length
                    ? `<span class="typo-weights">${t.weights.join(', ')}</span>`
                    : ''
                }
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>`
    : '';

  const manifesto = brand.strategy?.manifesto;
  const manifestoText =
    typeof manifesto === 'string'
      ? manifesto
      : manifesto?.full ||
        [manifesto?.provocation, manifesto?.tension, manifesto?.promise]
          .filter(Boolean)
          .join('\n\n');

  const strategySection =
    manifestoText || brand.strategy?.pillars?.length
      ? `<div class="section page-break">
        <h2>Brand Strategy</h2>
        ${
          manifestoText
            ? `<div class="manifesto"><p>${manifestoText.replace(/\n/g, '</p><p>')}</p></div>`
            : ''
        }
        ${
          brand.strategy?.pillars?.length
            ? `
          <h3>Pillars</h3>
          <div class="pillars-grid">
            ${brand.strategy.pillars
              .map(
                (p) => `
              <div class="pillar-card">
                <strong>${p.value}</strong>
                <p>${p.description}</p>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>`
      : '';

  const voiceSection =
    brand.guidelines?.voice || brand.guidelines?.dos?.length || brand.strategy?.voiceValues?.length
      ? `<div class="section">
        <h2>Voice & Tone</h2>
        ${brand.guidelines?.voice ? `<p class="voice-desc">${brand.guidelines.voice}</p>` : ''}
        ${
          brand.strategy?.voiceValues?.length
            ? `
          <div class="voice-grid">
            ${brand.strategy.voiceValues
              .map(
                (v) => `
              <div class="voice-card">
                <strong>${v.title}</strong>
                <p>${v.description}</p>
                <em>"${v.example}"</em>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }
        ${
          brand.guidelines?.dos?.length || brand.guidelines?.donts?.length
            ? `
          <div class="dos-donts">
            ${
              brand.guidelines?.dos?.length
                ? `
              <div class="dos">
                <h3>Do</h3>
                <ul>${brand.guidelines.dos.map((d) => `<li>${d}</li>`).join('')}</ul>
              </div>
            `
                : ''
            }
            ${
              brand.guidelines?.donts?.length
                ? `
              <div class="donts">
                <h3>Don't</h3>
                <ul>${brand.guidelines.donts.map((d) => `<li>${d}</li>`).join('')}</ul>
              </div>
            `
                : ''
            }
          </div>
        `
            : ''
        }
      </div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; background: #fff; }

    .cover {
      height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); color: #fff; text-align: center;
      page-break-after: always;
    }
    .cover h1 { font-size: 56px; font-weight: 700; letter-spacing: -1px; margin-bottom: 12px; }
    .cover .tagline { font-size: 18px; opacity: 0.6; font-weight: 300; letter-spacing: 2px; text-transform: uppercase; }
    .cover .accent-line { width: 60px; height: 3px; background: ${primaryColor}; margin: 24px auto; }

    .section { padding: 60px 80px; }
    .page-break { page-break-before: always; }
    h2 { font-size: 28px; font-weight: 600; margin-bottom: 32px; letter-spacing: -0.5px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 12px; }
    h3 { font-size: 18px; font-weight: 600; margin: 24px 0 16px; }

    .logo-grid { display: flex; flex-wrap: wrap; gap: 32px; }
    .logo-card { text-align: center; }
    .logo-card img { max-height: 80px; max-width: 200px; object-fit: contain; margin-bottom: 8px; }
    .logo-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; }

    .color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
    .color-card { border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
    .color-swatch { height: 80px; }
    .color-info { padding: 10px; font-size: 12px; }
    .color-info strong { display: block; margin-bottom: 4px; }
    .color-hex { font-family: monospace; color: #666; }
    .color-role, .color-cmyk { display: block; font-size: 10px; color: #999; margin-top: 2px; }

    .typo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; }
    .typo-card { padding: 20px; border: 1px solid #eee; border-radius: 8px; }
    .typo-sample { margin-bottom: 12px; color: #333; }
    .typo-info strong { display: block; font-size: 14px; }
    .typo-role { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    .typo-weights { font-size: 10px; color: #aaa; display: block; margin-top: 4px; }

    .manifesto { font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 32px; max-width: 640px; }
    .manifesto p { margin-bottom: 16px; }

    .pillars-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
    .pillar-card { padding: 20px; background: #f8f8f8; border-radius: 8px; }
    .pillar-card strong { display: block; margin-bottom: 8px; font-size: 15px; }
    .pillar-card p { font-size: 13px; color: #555; line-height: 1.5; }

    .voice-desc { font-size: 15px; line-height: 1.6; color: #444; margin-bottom: 24px; max-width: 600px; }
    .voice-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; margin-bottom: 32px; }
    .voice-card { padding: 20px; border: 1px solid #eee; border-radius: 8px; }
    .voice-card strong { display: block; margin-bottom: 6px; }
    .voice-card p { font-size: 13px; color: #555; margin-bottom: 8px; }
    .voice-card em { font-size: 12px; color: #888; }

    .dos-donts { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .dos h3 { color: #22c55e; }
    .donts h3 { color: #ef4444; }
    .dos-donts ul { list-style: none; padding: 0; }
    .dos-donts li { padding: 6px 0; font-size: 13px; color: #555; border-bottom: 1px solid #f0f0f0; }
    .dos li::before { content: '✓ '; color: #22c55e; font-weight: 600; }
    .donts li::before { content: '✕ '; color: #ef4444; font-weight: 600; }

    .footer { text-align: center; padding: 40px; font-size: 10px; color: #ccc; letter-spacing: 2px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${name}</h1>
    <div class="accent-line"></div>
    ${tagline ? `<div class="tagline">${tagline}</div>` : ''}
  </div>

  ${
    description
      ? `<div class="section"><p style="font-size:15px;line-height:1.7;color:#444;max-width:640px">${description}</p></div>`
      : ''
  }
  ${logoSection}
  ${colorSection}
  ${typoSection}
  ${strategySection}
  ${voiceSection}

  <div class="footer">Generated by Visant Labs</div>
</body>
</html>`;
}

export async function renderBrandBookPdf(
  brand: BrandBookData,
  opts: RenderOptions = {}
): Promise<Buffer> {
  const html = buildHtml(brand);
  const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });

    let result = Buffer.from(pdfBuffer);

    if (opts.compress !== false) {
      try {
        result = await compressPdf(result, opts.preset || 'ebook');
      } catch (err) {
        logger.warn({ err }, 'Brand book PDF compression failed, using uncompressed');
      }
    }

    return result;
  } finally {
    if (browser) await browser.close();
  }
}
