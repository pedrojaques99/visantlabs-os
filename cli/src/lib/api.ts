export const API_BASE = process.env.VISANT_API_URL ?? 'https://api.visantlabs.com/api'

export async function apiFetch(
  path: string,
  init: RequestInit & { token?: string } = {}
): Promise<any> {
  const { token, ...rest } = init
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((rest.headers as Record<string, string>) ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers })
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = { error: text } }

  if (!res.ok) {
    const msg = json?.error ?? json?.message ?? `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json
}
