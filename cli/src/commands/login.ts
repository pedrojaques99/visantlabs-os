import * as p from '@clack/prompts'
import chalk from 'chalk'
import { apiFetch } from '../lib/api.js'
import { browserOAuthFlow } from '../lib/oauth.js'
import { saveCredentials, loadCredentials } from '../lib/credentials.js'

export async function loginCommand(opts: { email?: boolean; browser?: boolean; e?: string; p?: string }) {
  console.log()
  p.intro(chalk.bold('Autenticação'))

  // Already logged in?
  const existing = loadCredentials()
  if (existing) {
    const reauth = await p.confirm({
      message: `Já autenticado como ${chalk.cyan(existing.email)}. Trocar de conta?`,
      initialValue: false,
    })
    if (p.isCancel(reauth) || !reauth) {
      p.outro(`Usando ${chalk.cyan(existing.email)}`)
      return
    }
  }

  let jwtToken: string
  let user: { id: string; email: string; name: string }

  // Non-interactive: visant login -e email -p password
  if (opts.e && opts.p) {
    const spin = p.spinner()
    spin.start('Autenticando…')
    try {
      const res = await apiFetch('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email: opts.e, password: opts.p }),
      })
      const keyRes = await apiFetch('/api-keys/create', {
        method: 'POST',
        token: res.token,
        body: JSON.stringify({ name: 'Visant CLI', scopes: ['read', 'write', 'generate'] }),
      })
      saveCredentials({ apiKey: keyRes.key, email: res.user.email, name: res.user.name, userId: res.user.id })
      spin.stop(`Autenticado como ${res.user.email}`)
      p.outro(`API key salva em ~/.visant/credentials.json\nExecute: visant setup`)
    } catch (err: any) {
      spin.stop('Falhou')
      p.cancel(err.message)
      process.exit(1)
    }
    return
  }

  if (opts.browser) {
    // ── Browser OAuth flow (opt-in) ─────────────────────────────────────────
    p.log.info('Abrindo o browser para autenticação…')
    p.log.info(chalk.dim('Se o browser não abrir, use: visant login (sem flags)'))

    const spin = p.spinner()
    spin.start('Aguardando aprovação no browser…')
    try {
      jwtToken = await browserOAuthFlow()
      const verifyRes = await apiFetch('/auth/verify', { token: jwtToken })
      user = verifyRes.user
      spin.stop('Autorizado')
    } catch (err: any) {
      spin.stop('Falhou')
      p.cancel(err.message)
      process.exit(1)
    }
  } else {
    // ── Default: email + password ───────────────────────────────────────────
    const email = await p.text({ message: 'Email:', placeholder: 'you@example.com' })
    if (p.isCancel(email)) { p.cancel('Cancelado.'); process.exit(0) }

    const password = await p.password({ message: 'Password:' })
    if (p.isCancel(password)) { p.cancel('Cancelado.'); process.exit(0) }

    const spin = p.spinner()
    spin.start('Autenticando…')
    try {
      const res = await apiFetch('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      jwtToken = res.token
      user = res.user
      spin.stop('Autenticado')
    } catch (err: any) {
      spin.stop('Falhou')
      p.cancel(err.message)
      process.exit(1)
    }
  }

  // ── Create permanent API key ──────────────────────────────────────────────
  const spin = p.spinner()
  spin.start('Criando API key permanente…')

  let apiKey: string
  try {
    const keyRes = await apiFetch('/api-keys/create', {
      method: 'POST',
      token: jwtToken!,
      body: JSON.stringify({ name: 'Visant CLI', scopes: ['read', 'write', 'generate'] }),
    })
    apiKey = keyRes.key
    spin.stop('API key criada')
  } catch (err: any) {
    spin.stop('Falhou ao criar API key')
    p.cancel(err.message)
    process.exit(1)
  }

  saveCredentials({ apiKey, email: user!.email, name: user!.name, userId: user!.id })

  p.outro(
    `${chalk.green('✓')} Autenticado como ${chalk.cyan(user!.email)}\n\n` +
    `  ${chalk.bold('visant mcp setup')} ${chalk.dim('→ conectar ao Claude Code')}\n` +
    `  ${chalk.bold('visant mcp status')} ${chalk.dim('→ verificar conexão')}`
  )
}
