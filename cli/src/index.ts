#!/usr/bin/env node
import chalk from 'chalk'
import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { logoutCommand } from './commands/logout.js'
import { whoamiCommand } from './commands/whoami.js'
import { mcpSetupCommand, mcpStatusCommand } from './commands/mcp.js'
import { skillsInstallCommand, skillsListCommand } from './commands/skills.js'

function printBanner() {
  console.log()
  console.log(chalk.cyan('      _    __ _________ ___    _   __ ______'))
  console.log(chalk.cyan('     | |  / //  _/ ___//   |  / | / //_  __/'))
  console.log(chalk.cyan('     | | / / / / \\__ \\/ /| | /  |/ /  / /   '))
  console.log(chalk.cyan('     | |/ /_/ / ___/ / ___ |/ /|  /  / /    '))
  console.log(chalk.cyan('     |___//___//____/_/  |_/_/ |_/  /_/     '))
  console.log()
  console.log(chalk.gray('      labs // copilot // creative brazil'))
  console.log()
}

const program = new Command()

program
  .name('visant')
  .description('Visant Labs CLI')
  .version('0.1.0')
  .hook('preAction', () => printBanner())

program
  .command('login')
  .description('Autenticar com Visant Labs')
  .option('--browser', 'Usar browser OAuth')
  .option('-e <email>', 'Email (não-interativo)')
  .option('-p <password>', 'Senha (não-interativo)')
  .action((opts) => loginCommand(opts))

program
  .command('logout')
  .description('Encerrar sessão')
  .action(() => logoutCommand())

program
  .command('whoami')
  .description('Mostrar usuário autenticado')
  .action(() => whoamiCommand())

const mcp = program.command('mcp').description('Gerenciar conexão MCP com Claude Code')

mcp
  .command('setup')
  .description('Configurar MCP no Claude Code (escreve .claude/settings.json)')
  .option('--project', 'Aplicar no projeto atual (sem prompt interativo)')
  .option('--global', 'Aplicar globalmente em todos os projetos')
  .action((opts) => mcpSetupCommand(opts))

mcp
  .command('status')
  .description('Verificar conexão com o servidor MCP')
  .action(() => mcpStatusCommand())

// Shortcut: visant setup = visant mcp setup --project
program
  .command('setup')
  .description('Atalho: configura MCP no projeto atual (= visant mcp setup --project)')
  .option('--global', 'Aplicar globalmente')
  .action((opts) => mcpSetupCommand({ project: !opts.global, ...opts }))

const skills = program.command('skills').description('Gerenciar skills Visant Labs para Claude Code')

skills
  .command('install')
  .description('Instalar todas as skills no ~/.claude/skills/')
  .option('--force', 'Sobrescrever skills existentes')
  .action((opts) => skillsInstallCommand(opts))

skills
  .command('list')
  .description('Listar skills disponíveis e status')
  .action(() => skillsListCommand())

// Default: visant skills (sem subcomando) = install
skills.action(() => skillsInstallCommand({}))

program.parse()
