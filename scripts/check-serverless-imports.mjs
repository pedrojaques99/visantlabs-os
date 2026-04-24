#!/usr/bin/env node
/**
 * check-serverless-imports.mjs
 *
 * Scans server/ and api/ for static top-level imports of packages known to
 * crash Vercel Lambda at cold-start time (they require browser globals or
 * native bindings unavailable in a sandboxed Node.js environment).
 *
 * Run: node scripts/check-serverless-imports.mjs
 * Exits 1 if violations are found — wire into the build script to block
 * deploys automatically.
 *
 * To add a new banned package: append to BANNED_TOP_LEVEL_IMPORTS below.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

// Packages that evaluate browser-only globals (DOMMatrix, ImageData, Path2D,
// document, window, etc.) or require native binaries at module load time.
// A dynamic import() inside a function body is safe — only top-level static
// `import … from '…'` statements are banned.
const BANNED_TOP_LEVEL_IMPORTS = [
  'pdfjs-dist',
  '@napi-rs/canvas',
  'canvas',
  'jsdom',
  'puppeteer',
  'playwright',
  'sharp',         // safe when lazy — crashes on some Lambda runtimes if top-level
  'jimp',          // pulls in @jimp/core which evaluates browser globals
]

const SCAN_DIRS = ['server', 'api']
const VALID_EXTS = new Set(['.ts', '.js', '.mts', '.mjs'])

// Matches: import … from 'pkg' or import 'pkg'
// Does NOT match dynamic import() — only static top-level imports.
function buildPattern(pkg) {
  // Escape dots in package names (e.g. @napi-rs/canvas)
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^import\\s+(?:[\\s\\S]*?from\\s+)?['"]${escaped}(?:[/'"])`, 'm')
}

const PATTERNS = BANNED_TOP_LEVEL_IMPORTS.map(pkg => ({ pkg, re: buildPattern(pkg) }))

function walk(dir) {
  const files = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
        files.push(...walk(full))
      } else if (VALID_EXTS.has(extname(entry))) {
        files.push(full)
      }
    }
  } catch {
    // dir doesn't exist — skip silently
  }
  return files
}

let violations = 0

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8')
    for (const { pkg, re } of PATTERNS) {
      if (re.test(src)) {
        console.error(
          `\n❌  Banned top-level import of '${pkg}'\n` +
          `   File: ${file}\n` +
          `   Fix:  use dynamic  await import('${pkg}')  inside the function body.\n` +
          `   Why:  this package evaluates browser globals or native bindings at\n` +
          `         module load time, crashing Vercel Lambda on cold-start.\n`
        )
        violations++
      }
    }
  }
}

if (violations === 0) {
  console.log('✅  check-serverless-imports: no banned top-level imports found.')
  process.exit(0)
} else {
  console.error(`\n🚫  Found ${violations} banned top-level import(s). Fix before deploying.\n`)
  process.exit(1)
}
