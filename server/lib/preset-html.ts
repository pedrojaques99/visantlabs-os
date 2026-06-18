/**
 * Web preset templates — the headless-renderable twin of the Figma `[Template]`s.
 * Pure HTML/CSS string builders: fill slots + brand tokens (CSS vars) + fonts →
 * a fixed-size document. Puppeteer screenshots it → PNG. Chromium renders it
 * pixel-perfect, so "open in a browser" IS the render (zero variance).
 *
 * Same contract as the Figma side: layout = the template, theme = CSS vars,
 * content = slots. One layout per function; the brand swaps via `PresetVars`.
 */

export interface PresetVars {
  bg: string;
  surface: string;
  text: string;
  heading: string;
  accent: string;
  accentText: string;
  headingFont: string;
  bodyFont: string;
  /** corner radius in px */
  radius: number;
}

export interface PostLaunchContent {
  h1: string;
  h2?: string;
  infos?: string[];
  photoUrl?: string;
  logoUrl?: string;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DOC = (
  width: number,
  height: number,
  fontCss: string,
  body: string,
  vars: PresetVars
) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
${fontCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${width}px;height:${height}px}
.frame{width:${width}px;height:${height}px;background:${vars.bg};color:${vars.text};
  font-family:'${vars.bodyFont}',system-ui,sans-serif;position:relative;overflow:hidden}
</style></head><body>${body}</body></html>`;

/** Post/Launch (1080×1350, 4:5) — the web twin of `[Template] Post/Launch`. */
export function postLaunchHtml(
  vars: PresetVars,
  content: PostLaunchContent,
  fontCss: string
): string {
  const W = 1080,
    H = 1350,
    PAD = 72;
  const photo = content.photoUrl ? `<img src="${esc(content.photoUrl)}" alt="">` : '';
  const h2 = content.h2 ? `<p class="h2">${esc(content.h2)}</p>` : '';
  const infos = content.infos?.length
    ? `<p class="infos">${content.infos.map(esc).join('<br>')}</p>`
    : '';
  const logo = content.logoUrl ? `<img class="logo" src="${esc(content.logoUrl)}" alt="">` : '';

  const body = `<div class="frame">
  <div class="photo">${photo}</div>
  <div class="content">
    <h1 class="h1">${esc(content.h1)}</h1>
    ${h2}
    ${infos}
  </div>
  ${logo}
  <style>
    .photo{position:absolute;top:${PAD}px;left:${PAD}px;width:${W - PAD * 2}px;height:620px;
      border-radius:${vars.radius}px;background:${vars.surface};overflow:hidden}
    .photo img{width:100%;height:100%;object-fit:cover;display:block}
    .content{position:absolute;left:${PAD}px;right:${PAD}px;top:760px}
    .h1{font-family:'${vars.headingFont}',serif;font-weight:600;font-size:92px;line-height:1.0;
      letter-spacing:-0.03em;color:${vars.accent}}
    .h2{font-size:38px;margin-top:28px;color:${vars.text};opacity:.82;font-weight:400}
    .infos{font-size:27px;line-height:1.5;margin-top:22px;color:${vars.text};opacity:.62}
    .logo{position:absolute;left:${PAD}px;bottom:${PAD}px;height:56px;width:auto;object-fit:contain;object-position:left}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}
