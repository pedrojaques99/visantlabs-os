// CLI: brand fixture OR live brand id → compile → write CSS + print the AA report.
//
//   node scripts/build.js                        # default Visant fixture
//   node scripts/build.js path/to/brand.json     # a captured seed
//   node scripts/build.js --brand <brandId>      # live, needs VISANT_API_TOKEN
//
// Output is named per brand. The previous build wrote `visant.tokens.css` for
// every input, so compiling two brands in a row silently overwrote the first.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { wcagContrast } from "culori";
import { compileBrandTokens, emitCss, loadCraft } from "../src/engine.js";
import { fetchBrand, brandSlug } from "../src/fetch-brand.js";
import { resolveFonts, fontReport } from "../src/fonts.js";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const semRede = argv.includes("--no-fonts");
const fontesEstritas = argv.includes("--strict-fonts");

async function loadSeed() {
  const brandFlag = argv.indexOf("--brand");
  if (brandFlag !== -1) {
    const id = argv[brandFlag + 1];
    if (!id) throw new Error("--brand needs a brand id");
    return fetchBrand(id);
  }
  const path = argv[0] ? resolve(argv[0]) : join(here, "../src/fixtures/visant.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

const brand = await loadSeed();
const compiled = compileBrandTokens(brand);

// Resolve as faces ANTES de emitir: o CSS precisa importar o que dá para
// carregar e declarar o que não dá. `--no-fonts` pula a rede (CI offline).
const fontes = semRede ? [] : await resolveFonts(compiled.type);
const css = emitCss(compiled, loadCraft(), { fonts: fontes });

const outDir = join(here, "../dist");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${brandSlug(brand)}.tokens.css`);
writeFileSync(outFile, css, "utf8");

// AA report — the trust anchor, printed so the output is inspectable.
const pair = (name, fg, bg) => {
  const c = wcagContrast(fg, bg);
  const ok = c >= 4.5 ? "PASS" : "FAIL";
  return `  ${ok}  ${c.toFixed(2)}:1  ${name}`;
};

const m = compiled.meta ?? {};
console.log(
  `\n${m.name ?? brandSlug(brand)}${m.completeness != null ? `  ·  vault ${m.completeness}% completo` : ""}`,
);
// Relatório de fonte — o par que faltava do de contraste. Cor era verificada
// e travava o build; tipografia era só afirmada. Ver src/fonts.js.
if (fontes.length) {
  console.log("\n[fonte]");
  for (const linha of fontReport(fontes)) console.log(linha);
} else {
  console.log(
    `\n[fonte] não verificada (--no-fonts) — display: ${compiled.type.display} · sans: ${compiled.type.sans}`,
  );
}

let failed = false;
for (const mode of ["light", "dark"]) {
  const t = compiled.themes[mode];
  console.log(`\n[${mode}]`);
  for (const line of [
    pair("foreground / background", t.foreground, t.background),
    pair("muted-foreground / background", t["muted-foreground"], t.background),
    pair("accent-ink / background", t["accent-ink"], t.background),
    pair("label on brand fill", t["brand-foreground"], t.brand),
  ]) {
    if (line.includes("FAIL")) failed = true;
    console.log(line);
  }
}

console.log(`\n✓ wrote ${outFile}`);

// Um build que emite par reprovado não pode parecer sucesso.
if (failed) {
  console.error("\n✗ contrast gate failed — tokens NOT fit to ship");
  process.exit(1);
}

// Fonte ausente NÃO reprova por padrão: face paga e licenciada é decisão
// legítima de marca. O que era inaceitável é sumir em silêncio — agora ela
// aparece no relatório e no topo do CSS. Com --strict-fonts, vira portão.
const ausentes = fontes.filter((f) => f.availability !== "google");
if (ausentes.length) {
  console.error(
    `\n⚠ ${ausentes.length} face(s) sem carregamento resolvido: ${ausentes
      .map((f) => f.family)
      .join(", ")}`,
  );
  console.error("  carregue via @font-face/next-font, ou corrija a família no vault.");
  if (fontesEstritas) process.exit(1);
}
