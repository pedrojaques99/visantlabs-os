import * as p from '@clack/prompts'
import chalk from 'chalk'
import { existsSync, mkdirSync, cpSync, readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUNDLED_SKILLS_DIR = join(__dirname, '..', 'skills')

function getSkillsTarget(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '~'
  return join(home, '.claude', 'skills')
}

function listBundledSkills(): string[] {
  if (!existsSync(BUNDLED_SKILLS_DIR)) return []
  return readdirSync(BUNDLED_SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
}

function getSkillMeta(skillDir: string): { name: string; description: string } {
  const skillMd = join(BUNDLED_SKILLS_DIR, skillDir, 'SKILL.md')
  if (!existsSync(skillMd)) return { name: skillDir, description: '' }
  const content = readFileSync(skillMd, 'utf-8')
  const nameMatch = content.match(/^name:\s*(.+)$/m)
  const descMatch = content.match(/^description:\s*"?([^"\n]+)"?$/m)
  return {
    name: nameMatch?.[1]?.trim() ?? skillDir,
    description: descMatch?.[1]?.trim().slice(0, 80) ?? '',
  }
}

export async function skillsInstallCommand(opts: { force?: boolean }) {
  console.log()
  p.intro(chalk.bold('Visant Skills'))

  const skills = listBundledSkills()
  if (skills.length === 0) {
    p.cancel('Nenhuma skill bundled encontrada. Reinstale o pacote visantlabs.')
    process.exit(1)
  }

  const target = getSkillsTarget()
  mkdirSync(target, { recursive: true })

  const installed: string[] = []
  const skipped: string[] = []

  for (const skill of skills) {
    const dest = join(target, skill)
    if (existsSync(dest) && !opts.force) {
      skipped.push(skill)
    } else {
      cpSync(join(BUNDLED_SKILLS_DIR, skill), dest, { recursive: true })
      installed.push(skill)
    }
  }

  if (installed.length > 0) {
    p.log.success(`${chalk.green(installed.length)} skills instaladas:`)
    for (const s of installed) {
      const meta = getSkillMeta(s)
      console.log(`  ${chalk.cyan('+')} ${meta.name}`)
    }
  }

  if (skipped.length > 0) {
    p.log.info(`${chalk.dim(skipped.length)} skills ja existiam (use --force para sobrescrever)`)
  }

  p.outro(
    `${chalk.green('Pronto!')} Skills disponiveis em ${chalk.dim(target)}\n\n` +
    `  Reinicie o Claude Code para ativar.`
  )
}

export async function skillsListCommand() {
  const skills = listBundledSkills()
  const target = getSkillsTarget()

  console.log()
  console.log(chalk.bold('  Visant Labs Skills'))
  console.log()

  for (const skill of skills) {
    const meta = getSkillMeta(skill)
    const isInstalled = existsSync(join(target, skill))
    const status = isInstalled ? chalk.green('installed') : chalk.dim('available')
    console.log(`  ${chalk.cyan(meta.name)} ${chalk.dim('—')} ${status}`)
    if (meta.description) {
      console.log(`    ${chalk.dim(meta.description)}`)
    }
  }

  console.log()
  console.log(`  ${chalk.dim('Instalar:')} visant skills install`)
  console.log()
}
