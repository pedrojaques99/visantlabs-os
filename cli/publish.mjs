#!/usr/bin/env node
// publish.mjs — build → publish → bump patch só se versão já existe → republish
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const DIR = dirname(fileURLToPath(import.meta.url))
const pkgPath = resolve(DIR, 'package.json')

function readPkg() { return JSON.parse(readFileSync(pkgPath, 'utf-8')) }

function run(cmd) {
  console.log(`\n  → ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: DIR, shell: true })
}

function tryPublish() {
  try {
    execSync('npm publish --access public', { cwd: DIR, shell: true, stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}

function bumpPatch() {
  const p = readPkg()
  const [major, minor, patch] = p.version.split('.').map(Number)
  p.version = `${major}.${minor}.${patch + 1}`
  writeFileSync(pkgPath, JSON.stringify(p, null, 2) + '\n', 'utf-8')
  return p.version
}

console.log('\n  📦 Visant CLI — publish\n')

// 1. npm login check
try { execSync('npm whoami', { stdio: 'pipe', shell: true }) }
catch { run('npm login') }
console.log('  npm user:', execSync('npm whoami', { encoding: 'utf-8', shell: true }).trim())

// 2. Build
run('npm run build')

// 3. Try publish
console.log('\n  → npm publish --access public')
if (!tryPublish()) {
  // Versão duplicada — bump e tenta de novo
  const next = bumpPatch()
  console.log(`\n  Versão já existe. Bumped para ${next}`)
  run('npm publish --access public')
}

const { name, version } = readPkg()
console.log(`\n  ✅ Publicado: ${name}@${version}`)
console.log(`  npm install -g visantlabs\n`)
