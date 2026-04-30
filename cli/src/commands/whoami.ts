import chalk from 'chalk'
import { loadCredentials } from '../lib/credentials.js'
import { apiFetch } from '../lib/api.js'

export async function whoamiCommand() {
  const creds = loadCredentials()
  if (!creds) {
    console.log(chalk.red('Não autenticado.') + chalk.dim(' Execute: visant login'))
    process.exit(1)
  }

  try {
    // Use an endpoint that accepts API keys (not just JWT)
    await apiFetch('/brand-guidelines', { token: creds.apiKey })
    console.log()
    console.log(`  ${chalk.bold('Usuário')}  ${chalk.cyan(creds.email)}`)
    console.log(`  ${chalk.bold('Nome   ')}  ${creds.name}`)
    console.log(`  ${chalk.bold('API key')}  ${creds.apiKey.slice(0, 18)}${'•'.repeat(20)}`)
    console.log()
  } catch {
    console.log(chalk.yellow('⚠ Token inválido ou expirado.') + chalk.dim(' Execute: visant login'))
    process.exit(1)
  }
}
