import * as p from '@clack/prompts'
import chalk from 'chalk'
import { clearCredentials, loadCredentials } from '../lib/credentials.js'

export async function logoutCommand() {
  const creds = loadCredentials()
  if (!creds) {
    console.log(chalk.dim('Nenhuma sessão ativa.'))
    return
  }
  clearCredentials()
  p.outro(`${chalk.green('✓')} Desconectado de ${chalk.cyan(creds.email)}`)
}
