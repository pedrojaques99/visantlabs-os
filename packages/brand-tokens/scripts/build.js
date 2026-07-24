// v0 CLI: read a brand fixture → compile → write CSS + print the AA report.
// Usage: node scripts/build.js [path-to-brand.json]  (defaults to Visant fixture)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { wcagContrast } from "culori";
import { compileBrandTokens, emitCss, loadCraft } from "../src/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const brandPath = process.argv[2]
  ? resolve(process.argv[2])
  : join(here, "../src/fixtures/visant.json");

const brand = JSON.parse(readFileSync(brandPath, "utf8"));
const compiled = compileBrandTokens(brand);
const css = emitCss(compiled, loadCraft());

const outDir = join(here, "../dist");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "visant.tokens.css");
writeFileSync(outFile, css, "utf8");

// AA report — the trust anchor, printed so the output is inspectable.
const pair = (name, fg, bg) => {
  const c = wcagContrast(fg, bg);
  const ok = c >= 4.5 ? "PASS" : "FAIL";
  return `  ${ok}  ${c.toFixed(2)}:1  ${name}`;
};
for (const mode of ["light", "dark"]) {
  const t = compiled.themes[mode];
  console.log(`\n[${mode}]`);
  console.log(pair("foreground / background", t.foreground, t.background));
  console.log(pair("muted-foreground / background", t["muted-foreground"], t.background));
  console.log(pair("accent-ink / background", t["accent-ink"], t.background));
  console.log(pair("brand-foreground / brand", t["brand-foreground"], t.brand));
}
console.log(`\n✓ wrote ${outFile}`);
