import * as p from '@clack/prompts'
import chalk from 'chalk'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { loadCredentials } from '../lib/credentials.js'
import { apiFetch } from '../lib/api.js'

const MCP_ENDPOINT = 'https://api.visantlabs.com/api/mcp'

function buildSettings(_apiKey: string) {
  return {
    mcpServers: {
      visant: {
        type: 'http',
        url: MCP_ENDPOINT,
      },
    },
  }
}

export async function mcpSetupCommand(opts: { project?: boolean; global?: boolean }) {
  console.log()
  p.intro(chalk.bold('Visant MCP Setup'))

  const creds = loadCredentials()
  if (!creds) {
    p.cancel(`Não autenticado. Execute ${chalk.bold('visant login')} primeiro.`)
    process.exit(1)
  }

  p.log.info(`Autenticado como ${chalk.cyan(creds.email)}`)

  const settingsPath = join(process.cwd(), '.claude', 'settings.json')
  const globalPath = join(
    process.env.HOME ?? process.env.USERPROFILE ?? '~',
    '.claude',
    'settings.json'
  )

  let targetPath: string
  if (opts.global) {
    targetPath = globalPath
  } else if (opts.project || !process.stdin.isTTY) {
    // Non-interactive (Claude Code terminal, CI) — default to project
    targetPath = settingsPath
  } else {
    const scope = await p.select({
      message: 'Onde aplicar o MCP?',
      options: [
        { value: 'project', label: 'Projeto atual', hint: settingsPath },
        { value: 'global', label: 'Global (todos os projetos)', hint: globalPath },
      ],
    })
    if (p.isCancel(scope)) { p.cancel('Cancelado.'); process.exit(0) }
    targetPath = scope === 'global' ? globalPath : settingsPath
  }

  // Merge with existing settings if any
  let existing: Record<string, any> = {}
  if (existsSync(targetPath)) {
    try { existing = JSON.parse(readFileSync(targetPath, 'utf-8')) } catch { /* start fresh */ }
  }

  const merged = { ...existing, ...buildSettings(creds.apiKey) }

  // Ensure .claude dir exists
  const { mkdirSync, dirname } = await import('path').then(async m => {
    const { mkdirSync } = await import('fs')
    return { mkdirSync, dirname: m.dirname }
  })
  mkdirSync(dirname(targetPath), { recursive: true })
  writeFileSync(targetPath, JSON.stringify(merged, null, 2), 'utf-8')

  p.outro(
    `${chalk.green('✓')} ${targetPath}\n\n` +
    `  ${chalk.bold('Próximo passo:')} reinicie o Claude Code — o browser vai abrir para autorizar.\n` +
    `  OAuth 2.1 com PKCE — zero token hardcoded, refresh automático.\n\n` +
    `  ${chalk.dim('Alternativa: claude mcp add --transport http visant')} ${chalk.dim(MCP_ENDPOINT)}`
  )
}

export async function mcpStatusCommand() {
  const creds = loadCredentials()
  if (!creds) {
    console.log(chalk.red('Não autenticado.') + chalk.dim(' Execute: visant login'))
    process.exit(1)
  }

  const spin = p.spinner()
  spin.start(`Testando autenticação…`)
  try {
    // Verify token works by hitting a real API endpoint
    const res = await apiFetch('/brand-guidelines', { token: creds.apiKey })
    const count: number = res?.guidelines?.length ?? res?.length ?? 0
    spin.stop(`${chalk.green('✓')} Conectado como ${chalk.cyan(creds.email)}`)

    console.log()
    console.log(`  ${chalk.dim('API:')}     https://api.visantlabs.com`)
    console.log(`  ${chalk.dim('Token:')}   ${creds.apiKey.slice(0, 18)}${'•'.repeat(16)}`)
    console.log(`  ${chalk.dim('Marcas:')}  ${count} disponíveis`)
    console.log()
    console.log(`  ${chalk.bold('MCP endpoint:')} ${MCP_ENDPOINT}`)
    console.log(`  ${chalk.dim('Configure com:')} visant setup`)
    console.log()
  } catch (err: any) {
    spin.stop(chalk.red('Falhou'))
    console.log(chalk.red(`\n  Erro: ${err.message}`))
    console.log(chalk.dim(`  Token inválido? Execute: visant login`))
    process.exit(1)
  }
}
