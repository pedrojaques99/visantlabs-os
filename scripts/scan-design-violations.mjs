#!/usr/bin/env node
/**
 * scan-design-violations.mjs
 *
 * Comprehensive design system linter + fixer — scans src/ for hardcoded tokens,
 * inconsistent values, missing component usage, and anti-patterns.
 *
 * Usage:
 *   node scripts/scan-design-violations.mjs              # audit (exit 1 if errors)
 *   node scripts/scan-design-violations.mjs --fix        # auto-fix errors
 *   node scripts/scan-design-violations.mjs --fix-all    # auto-fix errors + warnings
 *   node scripts/scan-design-violations.mjs --report     # write JSON to dist/
 *   node scripts/scan-design-violations.mjs --summary    # counts only
 *   node scripts/scan-design-violations.mjs --no-fail    # always exit 0
 */

import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const SRC_DIR = join(ROOT, 'src');
const ARGS = new Set(process.argv.slice(2));
const FIX_MODE = ARGS.has('--fix') || ARGS.has('--fix-all');
const FIX_ALL = ARGS.has('--fix-all');
const REPORT_MODE = ARGS.has('--report');
const SUMMARY_MODE = ARGS.has('--summary');
const NO_FAIL = ARGS.has('--no-fail');

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__tests__', 'test']);
const SCAN_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);
const norm = (p) => p.replace(/[\\/]/g, '/');

// ─── Allowlists ───────────────────────────────────────────────────────────────
const ALLOWLIST = [
  'src/lib/design-tokens.ts',
  'src/components/brand/BrandReadOnlyView.tsx',
  'src/components/branding/',
  'src/components/brand/guidelines/preview/',
  'src/components/brand/guidelines/DesignSystemValidation.tsx',
  'src/components/budget/',
  'src/components/3d-studio/',
  'src/components/3d/',
  'src/components/canvas/',
  'src/constants/canvasColors.ts',
  'src/components/ui/VHSText.tsx',
  'src/lib/liveblocks-presence.ts',
];

const RULE_ALLOWLIST = {
  'hardcoded-hex-color': ['src/components/mockupmachine/', 'src/pages/DesignSystemPage.tsx'],
  'glass-panel-manual': ['src/pages/DesignSystemPage.tsx'],
  'manual-micro-title': ['src/pages/DesignSystemPage.tsx', 'src/components/ui/MicroTitle.tsx'],
  'button-classname-override': ['src/pages/DesignSystemPage.tsx'],
  'border-not-semantic': ['src/pages/DesignSystemPage.tsx'],
  'inline-font-size': ['src/components/budget/'],
  'inline-letter-spacing': ['src/components/budget/'],
  'inline-box-shadow': ['src/components/canvas/'],
  'arbitrary-z-index': ['src/components/Layout.tsx', 'src/components/canvas/'],
  'manual-spinner': ['src/components/ui/GlitchLoader.tsx', 'src/components/ui/SkeletonLoader.tsx'],
  'manual-modal-backdrop': ['src/components/ui/Modal.tsx', 'src/components/ConfirmationModal.tsx'],
  'raw-destructive-color': ['src/components/ui/badge.tsx', 'src/components/ui/button.tsx'],
  'raw-success-color': ['src/components/ui/badge.tsx'],
  'manual-status-badge': ['src/components/ui/badge.tsx'],
  'hardcoded-cyan-shadow': ['src/components/ui/PremiumButton.tsx'],
};

function isAllowlisted(relPath, ruleId) {
  const n = norm(relPath);
  if (ALLOWLIST.some(a => n.startsWith(a))) return true;
  const ra = RULE_ALLOWLIST[ruleId];
  return ra ? ra.some(a => n.startsWith(a)) : false;
}

const ERROR = 'error';
const WARN = 'warn';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-FIX MAPS
// ═══════════════════════════════════════════════════════════════════════════════

const CYAN_RGBA_FIXES = [
  { from: /rgba\(\s*82\s*,\s*221\s*,\s*235\s*,\s*0\.0[1-5]\s*\)/g, to: 'oklch(from var(--brand-cyan) l c h / 5%)' },
  { from: /rgba\(\s*82\s*,\s*221\s*,\s*235\s*,\s*0\.1\s*\)/g,       to: 'oklch(from var(--brand-cyan) l c h / 10%)' },
  { from: /rgba\(\s*82\s*,\s*221\s*,\s*235\s*,\s*0\.15\s*\)/g,      to: 'oklch(from var(--brand-cyan) l c h / 15%)' },
  { from: /rgba\(\s*82\s*,\s*221\s*,\s*235\s*,\s*0\.2\s*\)/g,       to: 'oklch(from var(--brand-cyan) l c h / 20%)' },
  { from: /rgba\(\s*82\s*,\s*221\s*,\s*235\s*,\s*0\.3\s*\)/g,       to: 'oklch(from var(--brand-cyan) l c h / 30%)' },
  { from: /rgba\(\s*82\s*,\s*221\s*,\s*235\s*,\s*0\.4\s*\)/g,       to: 'oklch(from var(--brand-cyan) l c h / 40%)' },
  { from: /rgba\(\s*82\s*,\s*221\s*,\s*235\s*,\s*0\.5\s*\)/g,       to: 'oklch(from var(--brand-cyan) l c h / 50%)' },
  { from: /rgba\(\s*82\s*,\s*221\s*,\s*235\s*,\s*0\.8\s*\)/g,       to: 'oklch(from var(--brand-cyan) l c h / 80%)' },
  { from: /rgba\(\s*0\s*,\s*186\s*,\s*242\s*,\s*0\.0[1-5]\s*\)/g,   to: 'oklch(from var(--brand-cyan) l c h / 5%)' },
  { from: /rgba\(\s*0\s*,\s*186\s*,\s*242\s*,\s*0\.1\s*\)/g,        to: 'oklch(from var(--brand-cyan) l c h / 10%)' },
  { from: /rgba\(\s*0\s*,\s*186\s*,\s*242\s*,\s*0\.2\s*\)/g,        to: 'oklch(from var(--brand-cyan) l c h / 20%)' },
];

const Z_INDEX_FIXES = [
  { from: /z-\[1\]/g,   to: 'z-0' },
  { from: /z-\[5\]/g,   to: 'z-10' },
  { from: /z-\[10\]/g,  to: 'z-10' },
  { from: /z-\[15\]/g,  to: 'z-10' },
  { from: /z-\[20\]/g,  to: 'z-20' },
  { from: /z-\[25\]/g,  to: 'z-20' },
  { from: /z-\[30\]/g,  to: 'z-30' },
  { from: /z-\[35\]/g,  to: 'z-30' },
  { from: /z-\[40\]/g,  to: 'z-40' },
  { from: /z-\[45\]/g,  to: 'z-40' },
  { from: /z-\[50\]/g,  to: 'z-50' },
  { from: /z-\[55\]/g,  to: 'z-50' },
  { from: /z-\[60\]/g,  to: 'z-50' },
  { from: /z-\[70\]/g,  to: 'z-50' },
  { from: /z-\[80\]/g,  to: 'z-50' },
  { from: /z-\[90\]/g,  to: 'z-50' },
  { from: /z-\[99\]/g,  to: 'z-50' },
  { from: /z-\[100\]/g, to: 'z-50' },
  { from: /z-\[11\]/g,  to: 'z-10' },
];

const WHITE_OPACITY_FIXES = [
  { from: /(-white\/)\[0\.0[1-2]\]/g, to: '$1[0.03]' },
  { from: /(-white\/)\[0\.0[4-6]\]/g, to: '$15' },
  { from: /(-white\/)\[0\.0[7-9]\]/g, to: '$110' },
  { from: /(-white\/)\[0\.1[0-4]\]/g, to: '$110' },
  { from: /(-white\/)\[0\.15\]/g,     to: '$115' },
  { from: /(-white\/)\[0\.2[0-5]\]/g, to: '$120' },
  { from: /(-white\/)\[0\.3[0-5]\]/g, to: '$130' },
];

// Status color normalization — raw red → destructive, raw green → success pattern
const STATUS_COLOR_FIXES = [
  { from: /\btext-red-500\b(?!\/)/g, to: 'text-destructive' },
  { from: /\btext-red-400\b(?!\/)/g, to: 'text-destructive' },
  { from: /\btext-red-600\b(?!\/)/g, to: 'text-destructive' },
  { from: /\bbg-red-500\b(?!\/)/g,   to: 'bg-destructive' },
  { from: /\bbg-red-600\b(?!\/)/g,   to: 'bg-destructive' },
  // green/emerald → we can't use a semantic token yet, so normalize to green-500
  { from: /\btext-emerald-400\b(?!\/)/g, to: 'text-green-500' },
  { from: /\btext-emerald-500\b(?!\/)/g, to: 'text-green-500' },
  { from: /\bbg-emerald-500\b(?!\/)/g,   to: 'bg-green-500' },
  { from: /\bbg-emerald-400\b(?!\/)/g,   to: 'bg-green-500' },
  { from: /\bbg-red-400\b(?!\/)/g,       to: 'bg-destructive' },
  { from: /\btext-emerald-200\b(?!\/)/g,  to: 'text-green-400' },
];

// Opacity-suffixed status colors → normalize
const STATUS_OPACITY_FIXES = [
  { from: /\bbg-red-500\/10\b/g,     to: 'bg-destructive/10' },
  { from: /\bbg-red-500\/20\b/g,     to: 'bg-destructive/20' },
  { from: /\bborder-red-500\/20\b/g, to: 'border-destructive/20' },
  { from: /\bborder-red-500\/30\b/g, to: 'border-destructive/30' },
  { from: /\btext-red-500\/60\b/g,   to: 'text-destructive/60' },
  { from: /\btext-red-400\/60\b/g,   to: 'text-destructive/60' },
  { from: /\bbg-emerald-500\/10\b/g,     to: 'bg-green-500/10' },
  { from: /\bbg-emerald-500\/20\b/g,     to: 'bg-green-500/20' },
  { from: /\bborder-emerald-500\/20\b/g, to: 'border-green-500/20' },
  { from: /\bborder-emerald-500\/30\b/g, to: 'border-green-500/30' },
  { from: /\btext-emerald-300\b(?!\/)/g,  to: 'text-green-400' },
  { from: /\btext-emerald-400\b(?!\/)/g,  to: 'text-green-400' },
  { from: /\btext-emerald-500\b(?!\/)/g,  to: 'text-green-500' },
  { from: /\bhover:bg-emerald-500\/20\b/g, to: 'hover:bg-green-500/20' },
  { from: /\bbg-red-400\/10\b/g,     to: 'bg-destructive/10' },
  { from: /\bbg-red-400\/20\b/g,     to: 'bg-destructive/20' },
  { from: /\bborder-red-400\/20\b/g, to: 'border-destructive/20' },
  { from: /\bborder-red-400\/30\b/g, to: 'border-destructive/30' },
  { from: /\btext-red-300\b(?!\/)/g,  to: 'text-destructive' },
  { from: /\bbg-red-500\/5\b/g,      to: 'bg-destructive/5' },
  { from: /\bbg-red-400\/5\b/g,      to: 'bg-destructive/5' },
  { from: /\bbg-emerald-500\/30\b/g, to: 'bg-green-500/30' },
  { from: /\btext-emerald-400\/80\b/g, to: 'text-green-400/80' },
  { from: /\bbg-red-500\/40\b/g,       to: 'bg-destructive/40' },
  { from: /\bbg-emerald-500\/60\b/g,   to: 'bg-green-500/60' },
  { from: /\bbg-emerald-500\/(\[[\d.]+\])/g,     to: 'bg-green-500/$1' },
  { from: /\bborder-emerald-500\/(\[[\d.]+\])/g,  to: 'border-green-500/$1' },
  { from: /\btext-emerald-500\/(\[[\d.]+\])/g,    to: 'text-green-500/$1' },
  { from: /\btext-emerald-400\/(\[[\d.]+\])/g,    to: 'text-green-400/$1' },
  { from: /\btext-emerald-300\/(\[[\d.]+\])/g,    to: 'text-green-400/$1' },
  { from: /\bbg-red-500\/(\[[\d.]+\])/g,          to: 'bg-destructive/$1' },
  { from: /\bborder-red-500\/(\[[\d.]+\])/g,      to: 'border-destructive/$1' },
  { from: /\btext-red-500\/(\[[\d.]+\])/g,        to: 'text-destructive/$1' },
  { from: /\btext-red-400\/(\[[\d.]+\])/g,        to: 'text-destructive/$1' },
  // Catch-all: any red-N00/opacity → destructive/opacity (covers hover:, focus:, etc.)
  { from: /\b((?:hover:|focus:)?(?:bg|border|text))-red-[3-6]00\/(\d+)\b/g, to: '$1-destructive/$2' },
  { from: /\b((?:hover:|focus:)?(?:bg|border|text))-red-[3-6]00\/(\[[\d.]+\])/g, to: '$1-destructive/$2' },
  // Catch-all: any emerald-N00/opacity → green-500/opacity
  { from: /\b((?:hover:|focus:)?(?:bg|border|text))-emerald-[3-6]00\/(\d+)\b/g, to: '$1-green-500/$2' },
  { from: /\b((?:hover:|focus:)?(?:bg|border|text))-emerald-[3-6]00\/(\[[\d.]+\])/g, to: '$1-green-500/$2' },
];

// Border scope expansion — ghost borders everywhere, not just nodes
const BORDER_GLOBAL_FIXES = [
  { from: /\bborder-white\/5\b(?!\d)/g, to: 'border-neutral-800' },
];

// Cyan shadow patterns in inline styles
const CYAN_SHADOW_FIXES = [
  { from: /shadow-\[0_0_10px_rgba\(82,221,235,0\.2\)\]/g,  to: 'shadow-[0_0_10px_oklch(from_var(--brand-cyan)_l_c_h/20%)]' },
  { from: /shadow-\[0_0_10px_rgba\(82,221,235,0\.3\)\]/g,  to: 'shadow-[0_0_10px_oklch(from_var(--brand-cyan)_l_c_h/30%)]' },
  { from: /shadow-\[0_0_20px_rgba\(82,221,235,0\.4\)\]/g,  to: 'shadow-[0_0_20px_oklch(from_var(--brand-cyan)_l_c_h/40%)]' },
  { from: /drop-shadow-\[0_0_10px_rgba\(82,221,235,0\.2\)\]/g, to: 'drop-shadow-[0_0_10px_oklch(from_var(--brand-cyan)_l_c_h/20%)]' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RULE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const RULES = [

  // ─── COLOR TOKENS ───────────────────────────────────────────────────────────

  {
    id: 'hardcoded-cyan-rgba',
    severity: ERROR,
    description: 'Hardcoded rgba() for brand cyan — use bg-brand-cyan/XX or oklch(from var(--brand-cyan)...)',
    scope: 'all',
    pattern: /rgba\(\s*(?:0\s*,\s*186\s*,\s*242|82\s*,\s*221\s*,\s*235)/,
    autofix: CYAN_RGBA_FIXES,
  },
  {
    id: 'hardcoded-hex-color',
    severity: WARN,
    description: 'Hardcoded hex color — prefer semantic tokens (text-foreground, bg-card, border-border)',
    scope: 'all',
    pattern: /(?:className|style|color|background|border|fill|stroke).*#[0-9a-fA-F]{3,8}/,
    exclude: /#(?:000|fff|000000|ffffff)\b/i,
  },
  {
    id: 'nonstandard-white-opacity',
    severity: WARN,
    description: 'Non-standard white opacity — normalize to /[0.03], /5, /10, /15, /20, /30 scale',
    scope: 'all',
    pattern: /(?:bg|border|text|ring|shadow)-white\/\[0\.(?:01|02|04|06|08|12|25|35)\]/,
    autofix: WHITE_OPACITY_FIXES,
  },
  {
    id: 'hardcoded-status-with-opacity',
    severity: WARN,
    description: 'Status color with opacity — normalize red→destructive, emerald→green-500',
    scope: 'all',
    pattern: /(?:text|bg|border)-(?:red|emerald)-(?:3|4|5|6)00\//,
    exclude: /(?:from-|via-|to-)/,
    autofix: STATUS_OPACITY_FIXES,
  },
  {
    id: 'hardcoded-violet',
    severity: WARN,
    description: 'Hardcoded violet — prefer primary/accent semantic tokens',
    scope: 'all',
    pattern: /(?:text|bg|border)-violet-(?:3|4|5|6|7)00(?:\/|[\s'"])/,
  },
  {
    id: 'hardcoded-cyan-shadow',
    severity: WARN,
    description: 'Cyan shadow with hardcoded rgba — use oklch(from var(--brand-cyan)...)',
    scope: 'all',
    pattern: /shadow-\[.*rgba\(\s*(?:82\s*,\s*221\s*,\s*235|0\s*,\s*186\s*,\s*242)/,
    autofix: CYAN_SHADOW_FIXES,
  },

  // ─── BORDER TOKENS (global scope) ───────────────────────────────────────────

  {
    id: 'weak-border-token',
    severity: ERROR,
    description: 'border-neutral-800/5 or /10 — use full opacity border-neutral-800',
    scope: 'all',
    pattern: /border-neutral-800\/(5|10)\b/,
    autofix: [{ from: /border-neutral-800\/(5|10)\b/g, to: 'border-neutral-800' }],
  },
  {
    id: 'ghost-border',
    severity: WARN,
    description: 'border-white/5 — use border-neutral-800 for visibility',
    scope: 'all',
    pattern: /border-white\/5(?!\d)/,
    autofix: BORDER_GLOBAL_FIXES,
  },
  {
    id: 'plain-border-1px',
    severity: ERROR,
    description: "Standalone 'border' class in node — use 'border-node'",
    scope: 'reactflow',
    pattern: /\bborder\s+(?!node\b|border-)[a-zA-Z]/,
    autofix: [{ from: /\bborder\s+(transition|rounded|backdrop|cursor)/g, to: 'border-node $1' }],
  },
  {
    id: 'accent-border-on-focus',
    severity: ERROR,
    description: 'focus/hover brand-cyan border — banned on interactive elements',
    scope: 'all',
    pattern: /(?:focus|hover):border-brand-cyan/,
    autofix: [
      { from: /focus:border-brand-cyan[^\s"'`]*/g, to: 'focus:border-neutral-600' },
      { from: /hover:border-brand-cyan[^\s"'`]*/g, to: 'hover:border-neutral-700' },
    ],
  },
  {
    id: 'high-contrast-foreground-border',
    severity: ERROR,
    description: 'border-foreground/* — use border-neutral-600 or border-neutral-800',
    scope: 'all',
    pattern: /border-foreground\//,
    autofix: [
      { from: /border-foreground\/[4-6]0/g, to: 'border-neutral-600' },
      { from: /border-foreground\/\d+/g, to: 'border-neutral-800' },
    ],
  },
  {
    id: 'custom-node-header',
    severity: ERROR,
    description: 'Custom header div instead of <NodeHeader>',
    scope: 'reactflow',
    pattern: /border-b\s+border-neutral-700.*bg-gradient-to-r|bg-gradient-to-r.*border-b\s+border-neutral-700/,
  },
  {
    id: 'border-not-semantic',
    severity: WARN,
    description: 'border-neutral-800/XX in pages — prefer border-border or border-white/10',
    scope: 'pages',
    pattern: /border-neutral-800\/(?:20|30|40|50)\b/,
    autofix: [
      { from: /\bborder-neutral-800\/50\b/g, to: 'border-white/10' },
      { from: /\bborder-neutral-800\/40\b/g, to: 'border-white/10' },
      { from: /\bborder-neutral-800\/30\b/g, to: 'border-white/10' },
      { from: /\bborder-neutral-800\/20\b/g, to: 'border-white/10' },
    ],
  },

  // ─── RADIUS / SHAPE ─────────────────────────────────────────────────────────

  {
    id: 'rounded-xl-in-node-interactive',
    severity: ERROR,
    description: 'rounded-xl on node input — use rounded-md',
    scope: 'reactflow-and-ui',
    pattern: /(?:node-interactive|variant.*node|node.*variant).*rounded-xl|rounded-xl.*(?:node-interactive|variant.*node|node.*variant)/,
    autofix: [{ from: /rounded-xl/g, to: 'rounded-md' }],
  },
  {
    id: 'hardcoded-border-radius',
    severity: WARN,
    description: 'Hardcoded rounded-[Npx] — prefer rounded-sm/md/lg/xl or --radius token',
    scope: 'all',
    pattern: /rounded-\[\d+px\]/,
  },

  // ─── Z-INDEX ────────────────────────────────────────────────────────────────

  {
    id: 'arbitrary-z-index',
    severity: WARN,
    description: 'Arbitrary z-[N] — snap to standard z-0/10/20/30/40/50 scale',
    scope: 'all',
    pattern: /z-\[\d+\]/,
    exclude: /z-\[\d{4,}\]/,
    autofix: Z_INDEX_FIXES,
  },

  // ─── TYPOGRAPHY ─────────────────────────────────────────────────────────────

  {
    id: 'micro-text-7-8px',
    severity: ERROR,
    description: 'text-[7px] or text-[8px] — below minimum readable size',
    scope: 'all',
    pattern: /text-\[[78]px\]/,
    autofix: [{ from: /text-\[[78]px\]/g, to: 'text-[10px]' }],
  },
  {
    id: 'micro-text-9px',
    severity: WARN,
    description: 'text-[9px] — minimum readable size is 10px',
    scope: 'all',
    pattern: /text-\[9px\]/,
    autofix: [{ from: /text-\[9px\]/g, to: 'text-[10px]' }],
  },
  {
    id: 'inline-font-size',
    severity: WARN,
    description: 'Inline fontSize — use Tailwind text-xs/sm/base/lg or text-[Npx]',
    scope: 'all',
    pattern: /fontSize:\s*['"]?\d+/,
  },
  {
    id: 'inline-letter-spacing',
    severity: WARN,
    description: 'Inline letterSpacing — use Tailwind tracking-* classes',
    scope: 'all',
    pattern: /letterSpacing:\s*['"]/,
  },

  // ─── SHADOW / ELEVATION ─────────────────────────────────────────────────────

  {
    id: 'inline-box-shadow',
    severity: WARN,
    description: 'Inline boxShadow — extract to Tailwind shadow-* or CSS variable',
    scope: 'all',
    pattern: /boxShadow:\s*['"](?!none)/,
  },
  {
    id: 'hardcoded-shadow-class',
    severity: WARN,
    description: 'Hardcoded shadow-[...] with rgba — use CSS variable or oklch',
    scope: 'all',
    pattern: /shadow-\[0[_ ]+\d+px[_ ]+\d+px[_ ]+rgba\(/,
    exclude: /oklch|rgba\(0,\s*0,\s*0|rgba\(var\(--/, // oklch, pure black, or CSS var = fine
  },

  // ─── INLINE STYLE ANTI-PATTERNS ─────────────────────────────────────────────

  {
    id: 'inline-rgba',
    severity: WARN,
    description: 'Hardcoded rgba() in style — prefer oklch(from var(...)) or Tailwind opacity',
    scope: 'all',
    pattern: /style=\{[^}]*rgba\(/,
    exclude: /rgba\(\s*(?:0\s*,\s*0\s*,\s*0|255\s*,\s*255\s*,\s*255)/,
  },
  {
    id: 'inline-background-color',
    severity: WARN,
    description: 'Inline backgroundColor with hardcoded value — use Tailwind bg-* class',
    scope: 'all',
    pattern: /backgroundColor:\s*['"]#/,
  },
  {
    id: 'inline-border-style',
    severity: WARN,
    description: 'Inline border with hardcoded px/color — use Tailwind border-* classes',
    scope: 'all',
    pattern: /border:\s*['"]\d+(\.\d+)?px\s+solid/,
  },

  // ─── SPACING ────────────────────────────────────────────────────────────────

  {
    id: 'hardcoded-pixel-spacing',
    severity: WARN,
    description: 'Inline padding/margin/gap with pixel values — use Tailwind p-*/m-*/gap-*',
    scope: 'all',
    pattern: /(?:padding|margin|gap):\s*['"]?\d+px/,
    exclude: /padding:\s*0/,
  },

  // ─── COMPONENT USAGE (use the design system, don't recreate) ────────────────

  {
    id: 'manual-micro-title',
    severity: WARN,
    description: 'Manual MicroTitle pattern (text-[10px] font-mono text-neutral-500) — use <MicroTitle>',
    scope: 'all',
    pattern: /text-\[1[0-2]px\]\s+font-mono\s+text-neutral-500\b/,
  },
  {
    id: 'raw-destructive-color',
    severity: WARN,
    description: 'Raw red color class — use text-destructive / bg-destructive',
    scope: 'all',
    pattern: /(?:text|bg)-red-(?:4|5|6)00\b(?!\/)/,
    exclude: /(?:from-|via-|to-|Badge|variant)/,
    autofix: STATUS_COLOR_FIXES,
  },
  {
    id: 'raw-success-color',
    severity: WARN,
    description: 'Raw emerald color — normalize to green-500 (future: --success token)',
    scope: 'all',
    pattern: /(?:text|bg)-emerald-(?:4|5|6)00\b(?!\/)/,
    exclude: /(?:from-|via-|to-)/,
    autofix: STATUS_COLOR_FIXES,
  },
  {
    id: 'glass-panel-manual',
    severity: WARN,
    description: 'Manual glass panel (bg-neutral-900/30 border border-neutral-800/50 rounded) — use <GlassPanel>',
    scope: 'all',
    pattern: /bg-neutral-900\/30\s+border\s+border-neutral-800\/50\s+rounded/,
  },
  {
    id: 'button-classname-override',
    severity: WARN,
    description: 'Button variant="ghost" with heavy color overrides — use semantic variant',
    scope: 'all',
    pattern: /variant="ghost"[^>]*className="[^"]*(?:bg-|text-|border-)(?!neutral)[a-z]+-\d/,
  },
  {
    id: 'manual-status-badge',
    severity: WARN,
    description: 'Manual status pill (px-2 py-0.5 rounded-full bg-*-500/10) — use <Badge> with variant',
    scope: 'all',
    pattern: /px-[12]\.?5?\s+py-0\.5\s+rounded-full\s+.*(?:bg-(?:red|green|emerald|amber|blue)-|text-(?:red|green|emerald|amber|blue)-)/,
  },
  {
    id: 'manual-spinner',
    severity: WARN,
    description: 'Manual animate-spin loader — use <GlitchLoader> or <SkeletonLoader>',
    scope: 'all',
    pattern: /animate-spin[^"]*(?:w-[4-8]|h-[4-8]|size-[4-8]).*(?:border-|stroke-|text-)/,
  },
  {
    id: 'manual-modal-backdrop',
    severity: WARN,
    description: 'Manual modal backdrop (fixed inset-0 z-* bg-black/*) — use <Modal> component',
    scope: 'all',
    pattern: /fixed\s+inset-0\s+z-(?:50|\[(?:9999|999)\])\s+.*(?:bg-black|bg-neutral-950)/,
  },
  {
    id: 'manual-copy-state',
    severity: WARN,
    description: 'Manual copy-to-clipboard with useState — extract to useCopyToClipboard hook',
    scope: 'all',
    pattern: /navigator\.clipboard\.writeText.*setCopied|setCopied.*navigator\.clipboard/,
  },
];

// ─── File walker ──────────────────────────────────────────────────────────────
function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...walkDir(full));
    else if (SCAN_EXTENSIONS.has(extname(entry))) results.push(full);
  }
  return results;
}

// ─── Scope matching ───────────────────────────────────────────────────────────
function matchesScope(relPath, scope) {
  const n = norm(relPath);
  if (scope === 'all') return true;
  if (scope === 'reactflow') return n.includes('reactflow');
  if (scope === 'reactflow-and-ui') return n.includes('reactflow') || n.includes('components/ui');
  if (scope === 'pages') return n.includes('pages/');
  return false;
}

// ─── Scanner ──────────────────────────────────────────────────────────────────
function scanFile(filePath, rules) {
  const relPath = relative(ROOT, filePath);
  let src;
  try { src = readFileSync(filePath, 'utf8'); } catch { return { violations: [], fixed: false }; }

  const lines = src.split('\n');
  const violations = [];
  let modified = src;
  let didFix = false;

  for (const rule of rules) {
    if (!matchesScope(relPath, rule.scope)) continue;
    if (isAllowlisted(relPath, rule.id)) continue;

    // Detect violations
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('import ')) return;
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      if (rule.pattern.test(line)) {
        if (rule.exclude && rule.exclude.test(line)) return;
        violations.push({
          file: norm(relPath),
          line: i + 1,
          rule: rule.id,
          severity: rule.severity,
          description: rule.description,
          code: line.trim().slice(0, 140),
        });
      }
    });

    // Apply auto-fixes
    const shouldFix = FIX_MODE && rule.autofix && (rule.severity === ERROR || FIX_ALL);
    if (shouldFix) {
      for (const { from, to } of rule.autofix) {
        const next = modified.replace(from, to);
        if (next !== modified) { modified = next; didFix = true; }
      }
    }
  }

  if (didFix) writeFileSync(filePath, modified, 'utf8');
  return { violations, fixed: didFix };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const files = walkDir(SRC_DIR);
const allViolations = [];
let filesFixed = 0;

for (const f of files) {
  const { violations, fixed } = scanFile(f, RULES);
  allViolations.push(...violations);
  if (fixed) filesFixed++;
}

const errors = allViolations.filter(v => v.severity === ERROR);
const warns  = allViolations.filter(v => v.severity === WARN);

const byRule = {};
for (const v of allViolations) { (byRule[v.rule] ??= []).push(v); }

const sortedRules = Object.entries(byRule).sort((a, b) => {
  const sevA = a[1][0].severity === ERROR ? 0 : 1;
  const sevB = b[1][0].severity === ERROR ? 0 : 1;
  return sevA - sevB || b[1].length - a[1].length;
});

// ─── Output ───────────────────────────────────────────────────────────────────
if (allViolations.length === 0) {
  console.log('✓ No design system violations found.');
} else if (SUMMARY_MODE) {
  const fixableCount = allViolations.filter(v => RULES.find(r => r.id === v.rule)?.autofix).length;
  console.log(`\n  Design System Audit: ${errors.length} errors, ${warns.length} warnings (${fixableCount} auto-fixable)\n`);
  for (const [ruleId, items] of sortedRules) {
    const sev = items[0].severity === ERROR ? '\x1b[31mERR\x1b[0m' : '\x1b[33mWRN\x1b[0m';
    const fixable = RULES.find(r => r.id === ruleId)?.autofix ? ' \x1b[36m[fixable]\x1b[0m' : '';
    console.log(`  ${sev}  ${ruleId}: ${items.length}${fixable}`);
  }
  console.log('');
} else {
  console.log(`\n╔══ Design System Violations: ${errors.length} errors, ${warns.length} warnings ══╗\n`);
  for (const [ruleId, items] of sortedRules) {
    const sev = items[0].severity === ERROR ? '\x1b[31mERR\x1b[0m' : '\x1b[33mWRN\x1b[0m';
    const fixable = RULES.find(r => r.id === ruleId)?.autofix ? ' \x1b[36m[auto-fixable]\x1b[0m' : '';
    console.log(`${sev} [${ruleId}] ${items[0].description}${fixable}`);
    for (const v of items.slice(0, 5)) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.code}`);
    }
    if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
    console.log('');
  }
}

if (FIX_MODE && filesFixed > 0) {
  console.log(`\x1b[32m✓ Auto-fixed ${filesFixed} file(s)\x1b[0m\n`);
}

if (REPORT_MODE) {
  const distDir = join(ROOT, 'dist');
  if (!existsSync(distDir)) mkdirSync(distDir);
  const reportPath = join(distDir, 'design-violations.json');
  const fixableCount = allViolations.filter(v => RULES.find(r => r.id === v.rule)?.autofix).length;
  writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary: { errors: errors.length, warnings: warns.length, fixable: fixableCount, filesScanned: files.length, filesFixed },
    byRule: Object.fromEntries(sortedRules.map(([k, v]) => [k, {
      count: v.length, severity: v[0].severity, fixable: !!RULES.find(r => r.id === k)?.autofix,
      files: [...new Set(v.map(i => i.file))],
    }])),
    violations: allViolations,
  }, null, 2));
  console.log(`Report: ${relative(ROOT, reportPath)}\n`);
}

process.exit(!NO_FAIL && errors.length > 0 ? 1 : 0);
