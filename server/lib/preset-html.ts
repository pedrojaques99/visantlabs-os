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

export interface StorySaleContent {
  h1: string;
  h2?: string;
  cta?: string;
  photoUrl?: string;
}

/** Story/Sale (1080×1920, 9:16) — rounded photo card + centered headline + CTA. */
export function storySaleHtml(
  vars: PresetVars,
  content: StorySaleContent,
  fontCss: string
): string {
  const W = 1080,
    H = 1920;
  const photo = content.photoUrl ? `<img src="${esc(content.photoUrl)}" alt="">` : '';
  const h2 = content.h2 ? `<p class="h2">${esc(content.h2)}</p>` : '';
  const cta = content.cta ? `<div class="cta">${esc(content.cta)}</div>` : '';

  const body = `<div class="frame">
  <div class="photo">${photo}</div>
  <h1 class="h1">${esc(content.h1)}</h1>
  ${h2}
  ${cta}
  <style>
    .photo{position:absolute;top:180px;left:100px;width:880px;height:880px;
      border-radius:${vars.radius}px;background:${vars.surface};overflow:hidden}
    .photo img{width:100%;height:100%;object-fit:cover;display:block}
    .h1{position:absolute;top:1150px;left:100px;width:880px;text-align:center;
      font-family:'${vars.headingFont}',serif;font-weight:600;font-size:84px;line-height:1.02;
      letter-spacing:-0.03em;color:${vars.accent}}
    .h2{position:absolute;top:1400px;left:100px;width:880px;text-align:center;
      font-size:38px;color:${vars.text};opacity:.82}
    .cta{position:absolute;top:1600px;left:50%;transform:translateX(-50%);
      padding:22px 46px;border-radius:999px;background:${vars.accent};color:${vars.accentText};
      font-weight:700;font-size:34px}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}

export interface EditorialHeroContent {
  h1: string;
  /** small superscript annotation above the headline, e.g. "(mais)" */
  note?: string;
  /** top-left tag pill, e.g. a year "2025" */
  tag?: string;
  /** bottom-left studio/footer label, e.g. "VISANT BRAND STUDIO" */
  footer?: string;
  /** bottom-right region pill, e.g. "BR" */
  region?: string;
  photoUrl?: string;
}

/** Editorial/Hero (1080×1350) — dark editorial: tag pill + oversized lowercase
 * headline (with a small superscript note) + a floating brand image + footer
 * chrome (studio label · divider · region pill) + arrow. Token-driven. */
export function editorialHeroHtml(
  vars: PresetVars,
  content: EditorialHeroContent,
  fontCss: string
): string {
  const W = 1080,
    H = 1350,
    PAD = 80;
  const note = content.note ? `<span class="note">${esc(content.note)}</span>` : '';
  const tag = content.tag ? `<div class="tag">${esc(content.tag)}</div>` : '';
  const photo = content.photoUrl ? `<img class="hero" src="${esc(content.photoUrl)}" alt="">` : '';
  const footer = content.footer ? esc(content.footer) : '';
  const region = content.region ? `<div class="region">${esc(content.region)}</div>` : '';

  const body = `<div class="frame">
  ${tag}
  ${photo}
  <div class="head">${note}<h1 class="h1">${esc(content.h1)}</h1></div>
  <div class="foot">
    <span class="brand">${footer}</span>
    <span class="rule"></span>
    ${region}
  </div>
  <style>
    .tag{position:absolute;top:${PAD - 8}px;left:${PAD}px;padding:10px 24px;border-radius:999px;
      border:1px solid ${vars.text}40;color:${vars.text};opacity:.7;font-size:24px}
    .hero{position:absolute;top:300px;right:-30px;width:640px;height:auto;object-fit:contain}
    .head{position:absolute;top:150px;left:${PAD}px;width:760px;z-index:2}
    .note{display:block;margin-left:170px;margin-bottom:4px;font-size:30px;color:${vars.text};opacity:.6}
    .h1{font-family:'${vars.headingFont}',serif;font-weight:600;font-size:150px;line-height:0.92;
      letter-spacing:-0.04em;color:${vars.heading};text-transform:lowercase}
    .foot{position:absolute;left:${PAD}px;right:${PAD}px;bottom:${PAD}px;display:flex;align-items:center;gap:24px}
    .brand{font-size:22px;letter-spacing:0.12em;text-transform:uppercase;color:${vars.text};opacity:.55;white-space:nowrap}
    .rule{flex:1;height:1px;background:${vars.text};opacity:.22}
    .region{padding:8px 20px;border-radius:999px;border:1px solid ${vars.text}40;color:${vars.text};
      opacity:.7;font-size:22px}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}

export interface EditorialManifestoContent {
  h1: string;
  /** left data list under the image */
  infos?: string[];
  /** right paragraph under the image */
  body?: string;
  photoUrl?: string;
}

/** Editorial/Manifesto (1080×1350) — light editorial: centered image + a
 * two-column caption (data list · paragraph) + an oversized bottom headline. */
export function editorialManifestoHtml(
  vars: PresetVars,
  content: EditorialManifestoContent,
  fontCss: string
): string {
  const W = 1080,
    H = 1350;
  const photo = content.photoUrl ? `<img src="${esc(content.photoUrl)}" alt="">` : '';
  const infos = content.infos?.length
    ? `<p class="infos">${content.infos.map(esc).join('<br>')}</p>`
    : '';
  const para = content.body ? `<p class="para">${esc(content.body)}</p>` : '';

  const body = `<div class="frame">
  <div class="photo">${photo}</div>
  <div class="cols">${infos}${para}</div>
  <h1 class="h1">${esc(content.h1)}</h1>
  <style>
    .photo{position:absolute;top:60px;left:340px;width:400px;height:400px;
      background:${vars.surface};overflow:hidden}
    .photo img{width:100%;height:100%;object-fit:cover;display:block}
    .cols{position:absolute;top:560px;left:170px;right:170px;display:flex;justify-content:space-between;gap:60px}
    .infos{font-size:24px;line-height:1.55;color:${vars.text};opacity:.7;width:300px}
    .para{font-size:24px;line-height:1.55;color:${vars.text};opacity:.7;width:300px;text-align:right}
    .h1{position:absolute;left:60px;right:60px;bottom:70px;
      font-family:'${vars.headingFont}',serif;font-weight:600;font-size:80px;line-height:1.05;
      letter-spacing:-0.02em;color:${vars.heading}}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}

export interface ObraDeArteContent {
  h1: string;
  logoUrl?: string;
}

/** Obra-de-Arte (1080×1350) — branded gradient editorial: big headline + wordmark.
 * The gradient themes off the brand accent (dark→accent via color-mix). */
export function obraDeArteHtml(
  vars: PresetVars,
  content: ObraDeArteContent,
  fontCss: string
): string {
  const W = 1080,
    H = 1350;
  const logo = content.logoUrl
    ? `<img class="logo" src="${esc(content.logoUrl)}" alt="">`
    : '';

  const body = `<div class="frame">
  <h1 class="h1">${esc(content.h1)}</h1>
  ${logo}
  <style>
    .frame{background:linear-gradient(135deg,
      color-mix(in srgb, ${vars.accent} 35%, #0b0612) 0%, ${vars.accent} 100%)}
    .h1{position:absolute;top:110px;left:90px;width:760px;
      font-family:'${vars.headingFont}',serif;font-weight:600;font-size:92px;line-height:1.0;
      letter-spacing:-0.03em;color:#EFEFEF}
    .logo{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);
      height:120px;width:auto;object-fit:contain;filter:brightness(0) invert(1)}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}

/* ─────────────────────────  Landscape deck slides (1920×1080)  ───────────────────────── */

export interface SlideCoverContent {
  /** caption under the logo, e.g. "APRESENTAÇÃO DE LOGOTIPOS & SUBMARCAS" */
  subtitle?: string;
  /** small footer line, e.g. "VISANT® // 2026" */
  footer?: string;
  /** right-side boxed agenda/nav list */
  nav?: string[];
  logoUrl?: string;
}

/** Slide/Cover (1920×1080) — deck opener: brand logo lockup + caption + footer,
 * with a bordered nav/agenda list anchored bottom-right. */
export function slideCoverHtml(
  vars: PresetVars,
  content: SlideCoverContent,
  fontCss: string
): string {
  const W = 1920,
    H = 1080,
    PAD = 130;
  const logo = content.logoUrl ? `<img class="logo" src="${esc(content.logoUrl)}" alt="">` : '';
  const subtitle = content.subtitle ? `<p class="sub">${esc(content.subtitle)}</p>` : '';
  const footer = content.footer ? `<p class="foot">${esc(content.footer)}</p>` : '';
  const nav = content.nav?.length
    ? `<div class="nav">${content.nav.map((n) => `<span>→ ${esc(n)}</span>`).join('')}</div>`
    : '';

  const body = `<div class="frame">
  ${logo}
  ${subtitle}
  ${footer}
  ${nav}
  <style>
    .logo{position:absolute;left:${PAD}px;top:430px;height:96px;width:auto;object-fit:contain;object-position:left}
    .sub{position:absolute;left:${PAD}px;bottom:220px;width:620px;font-size:26px;line-height:1.45;
      letter-spacing:0.06em;text-transform:uppercase;color:${vars.text};opacity:.6}
    .foot{position:absolute;left:${PAD}px;bottom:150px;font-size:24px;letter-spacing:0.06em;
      color:${vars.text};opacity:.45}
    .nav{position:absolute;right:${PAD}px;bottom:200px;display:flex;flex-direction:column;gap:14px;
      padding:34px 44px;border:1px solid ${vars.text}33;border-radius:${vars.radius}px}
    .nav span{font-size:24px;letter-spacing:0.08em;text-transform:uppercase;color:${vars.text};opacity:.75}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}

export interface SlideAgendaContent {
  h1: string;
  /** numbered agenda items */
  infos?: string[];
  photoUrl?: string;
}

/** Slide/Agenda (1920×1080) — oversized headline + numbered arrow list (left),
 * supporting photo (right). */
export function slideAgendaHtml(
  vars: PresetVars,
  content: SlideAgendaContent,
  fontCss: string
): string {
  const W = 1920,
    H = 1080,
    PAD = 120;
  const photo = content.photoUrl ? `<img src="${esc(content.photoUrl)}" alt="">` : '';
  const items = content.infos?.length
    ? `<ol class="list">${content.infos
        .map((it, i) => `<li><span class="n">${i + 1}</span><span class="ar">→</span>${esc(it)}</li>`)
        .join('')}</ol>`
    : '';

  const body = `<div class="frame">
  <h1 class="h1">${esc(content.h1)}</h1>
  ${items}
  <div class="photo">${photo}</div>
  <style>
    .h1{position:absolute;left:${PAD}px;top:150px;width:820px;
      font-family:'${vars.headingFont}',serif;font-weight:600;font-size:118px;line-height:0.95;
      letter-spacing:-0.03em;color:${vars.heading};text-transform:uppercase}
    .list{position:absolute;left:${PAD}px;bottom:160px;list-style:none;display:flex;flex-direction:column;gap:14px}
    .list li{font-size:26px;color:${vars.text};opacity:.85;display:flex;align-items:center;gap:16px}
    .list .n{width:30px;color:${vars.text};opacity:.5}
    .list .ar{color:${vars.accent}}
    .photo{position:absolute;right:${PAD}px;top:250px;width:720px;height:580px;
      border-radius:${vars.radius}px;background:${vars.surface};overflow:hidden}
    .photo img{width:100%;height:100%;object-fit:cover;display:block}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}

export interface SlideSectionContent {
  h1: string;
  body?: string;
  photoUrl?: string;
}

/** Slide/Section (1920×1080) — workhorse content slide: tracked eyebrow title +
 * body paragraph + accent arrow (left), supporting image (right). */
export function slideSectionHtml(
  vars: PresetVars,
  content: SlideSectionContent,
  fontCss: string
): string {
  const W = 1920,
    H = 1080,
    PAD = 130;
  const photo = content.photoUrl ? `<img src="${esc(content.photoUrl)}" alt="">` : '';
  const para = content.body ? `<p class="body">${esc(content.body)}</p>` : '';

  const body = `<div class="frame">
  <h1 class="h1">${esc(content.h1)}</h1>
  ${para}
  <div class="arrow">→</div>
  <div class="photo">${photo}</div>
  <style>
    .h1{position:absolute;left:${PAD}px;top:400px;width:560px;
      font-family:'${vars.headingFont}',serif;font-weight:600;font-size:50px;line-height:1.1;
      letter-spacing:0.12em;text-transform:uppercase;color:${vars.heading}}
    .body{position:absolute;left:${PAD}px;top:510px;width:520px;font-size:25px;line-height:1.5;
      color:${vars.text};opacity:.7}
    .arrow{position:absolute;left:${PAD}px;top:720px;font-size:40px;color:${vars.accent}}
    .photo{position:absolute;right:${PAD}px;top:260px;width:760px;height:560px;
      border-radius:${vars.radius}px;background:${vars.surface};overflow:hidden}
    .photo img{width:100%;height:100%;object-fit:cover;display:block}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}

export interface SlideStepsContent {
  h1: string;
  body?: string;
  /** each step is "Title — caption" (the em-dash splits title from caption) */
  steps?: string[];
}

/** Slide/Steps (1920×1080) — process slide: title + intro body (top) + a row of
 * numbered steps (bottom). Each step string splits on " — " into title · caption. */
export function slideStepsHtml(
  vars: PresetVars,
  content: SlideStepsContent,
  fontCss: string
): string {
  const W = 1920,
    H = 1080,
    PAD = 120;
  const para = content.body ? `<p class="body">${esc(content.body)}</p>` : '';
  const steps = content.steps?.length
    ? `<div class="steps">${content.steps
        .map((s, i) => {
          const [title, ...rest] = s.split(' — ');
          const cap = rest.join(' — ');
          return `<div class="step">
            <span class="num">${i + 1}</span>
            <p class="st">${esc(title)}</p>
            ${cap ? `<p class="sc">${esc(cap)}</p>` : ''}
          </div>`;
        })
        .join('')}</div>`
    : '';

  const body = `<div class="frame">
  <h1 class="h1">${esc(content.h1)}</h1>
  ${para}
  ${steps}
  <style>
    .h1{position:absolute;left:${PAD}px;top:300px;width:640px;
      font-family:'${vars.headingFont}',serif;font-weight:600;font-size:66px;line-height:1.0;
      letter-spacing:-0.02em;color:${vars.heading}}
    .body{position:absolute;left:1140px;top:310px;width:660px;font-size:25px;line-height:1.5;
      color:${vars.text};opacity:.7}
    .steps{position:absolute;left:${PAD}px;right:${PAD}px;top:640px;display:flex;gap:36px}
    .step{flex:1}
    .num{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:999px;
      border:1px solid ${vars.accent};color:${vars.accent};font-size:22px;margin-bottom:20px}
    .st{font-size:24px;font-weight:600;color:${vars.heading};margin-bottom:10px}
    .sc{font-size:20px;line-height:1.45;color:${vars.text};opacity:.6}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}
