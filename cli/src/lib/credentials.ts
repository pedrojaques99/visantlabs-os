import { homedir } from 'os'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'fs'

export interface Credentials {
  apiKey: string       // visant_sk_... permanent key
  email: string
  name: string
  userId: string
}

const CREDS_DIR = join(homedir(), '.visant')
const CREDS_FILE = join(CREDS_DIR, 'credentials.json')

export function loadCredentials(): Credentials | null {
  try {
    if (!existsSync(CREDS_FILE)) return null
    return JSON.parse(readFileSync(CREDS_FILE, 'utf-8'))
  } catch {
    return null
  }
}

export function saveCredentials(creds: Credentials): void {
  if (!existsSync(CREDS_DIR)) mkdirSync(CREDS_DIR, { recursive: true })
  writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), 'utf-8')
  try { chmodSync(CREDS_FILE, 0o600) } catch { /* windows */ }
}

export function clearCredentials(): void {
  try { writeFileSync(CREDS_FILE, '', 'utf-8') } catch { /* ignore */ }
}
