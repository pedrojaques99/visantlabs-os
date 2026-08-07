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

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

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
const css = emitCss(compiled, loadCraft());

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
console.log(`  type — display: ${compiled.type.display} · sans: ${compiled.type.sans}`);

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
