/**
 * Shared SSRF-safe image URL validation.
 * Blocks private IPs (IPv4 + IPv6), metadata endpoints, and non-http protocols.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '[::ffff:127.0.0.1]',
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254',
]);

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d+$/.test(p))) return false;
  const first = parseInt(parts[0]);
  const second = parseInt(parts[1]);
  if (first === 10 || first === 127) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;
  if (first === 0) return true;
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (bare === '::1' || bare === '::') return true;
  if (bare.startsWith('::ffff:')) return true;
  if (bare.startsWith('fe80:')) return true;
  if (bare.startsWith('fc') || bare.startsWith('fd')) return true;
  return false;
}

export function validateImageUrl(url: string): void {
  if (url.startsWith('data:')) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid image URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error('URL hostname is not allowed.');
  }

  if (isPrivateIPv4(hostname)) {
    throw new Error('Private IP addresses are not allowed.');
  }

  if (isPrivateIPv6(hostname)) {
    throw new Error('Private IPv6 addresses are not allowed.');
  }
}
