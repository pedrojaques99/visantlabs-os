#!/usr/bin/env node
/**
 * check-console-logs.mjs
 *
 * Warns when console.log / console.warn / console.info / console.debug
 * are used directly in src/ files. These are silenced by Vite's `pure`
 * option in production builds, but leaking debug output in development
 * hurts DX and makes prod debugging harder when someone tests a prod build.
 *
 * This script is intentionally WARNING-only (exits 0) so it never blocks
 * a deploy — the Vite `pure` config already handles prod silencing.
 * Flip EXIT_CODE to 1 if you want to enforce zero tolerance.
 *
 * Run: node scripts/check-console-logs.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const SCAN_DIRS = ['src']
const VALID_EXTS = new Set(['.ts', '.tsx'])
const EXIT_CODE = 0 // change to 1 to make this blocking

// Match console.log/warn/info/debug — NOT console.error (kept in prod)
const BANNED = /console\.(log|warn|info|debug)\s*\(/

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
  } catch {}
  return files
}

let hits = 0

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      // Skip commented-out lines
      if (/^\s*\/\//.test(line)) return
      if (BANNED.test(line)) {
        console.warn(`  ⚠️  ${file}:${i + 1}  →  ${line.trim()}`)
        hits++
      }
    })
  }
}

if (hits === 0) {
  console.log('✅  check-console-logs: no stray console.log/warn/info/debug found in src/.')
} else {
  console.warn(`\n⚠️  Found ${hits} console.log/warn/info/debug call(s) in src/.`)
  console.warn('   These are silenced in production by Vite\'s "pure" option.')
  console.warn('   Consider replacing with a dev-only logger or removing them.\n')
}

process.exit(EXIT_CODE)
