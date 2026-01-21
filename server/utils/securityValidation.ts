/**
 * Security validation utilities for SSRF protection and type-safe error handling
 */

// Blocked IP ranges for SSRF protection
const BLOCKED_IP_PATTERNS = [
  /^127\./,                       // Loopback (127.0.0.0/8)
  /^10\./,                        // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[01])\./,   // Private Class B (172.16.0.0/12)
  /^192\.168\./,                  // Private Class C (192.168.0.0/16)
  /^169\.254\./,                  // Link-local / AWS/GCP metadata (169.254.0.0/16)
  /^0\./,                         // Current network (0.0.0.0/8)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)
  /^192\.0\.0\./,                 // IETF Protocol Assignments (192.0.0.0/24)
  /^192\.0\.2\./,                 // TEST-NET-1 (192.0.2.0/24)
  /^198\.51\.100\./,              // TEST-NET-2 (198.51.100.0/24)
  /^203\.0\.113\./,               // TEST-NET-3 (203.0.113.0/24)
  /^224\./,                       // Multicast (224.0.0.0/4)
  /^240\./,                       // Reserved (240.0.0.0/4)
  /^255\.255\.255\.255$/,         // Broadcast
  /^::1$/,                        // IPv6 loopback
  /^fc00:/i,                      // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,             // IPv6 unique local
  /^fe80:/i,                      // IPv6 link-local
  /^::ffff:127\./i,               // IPv4-mapped IPv6 loopback
  /^::ffff:10\./i,                // IPv4-mapped IPv6 private
  /^::ffff:172\.(1[6-9]|2\d|3[01])\./i, // IPv4-mapped IPv6 private
  /^::ffff:192\.168\./i,          // IPv4-mapped IPv6 private
  /^::ffff:169\.254\./i,          // IPv4-mapped IPv6 link-local
];

// Blocked hostnames for SSRF protection
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',     // GCP metadata
  'metadata',                     // GCP metadata short
  'instance-data',                // AWS metadata alias
  'kubernetes.default',           // Kubernetes internal
  'kubernetes.default.svc',       // Kubernetes internal
];

export class SSRFValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFValidationError';
  }
}

interface UrlValidationResult {
  valid: boolean;
  error?: string;
  url?: string;
}

/**
 * Validates that a URL is safe for server-side fetching (SSRF protection)
 * Blocks internal IPs, localhost, and cloud metadata endpoints
 */
export function validateExternalUrl(url: string): UrlValidationResult {
  if (typeof url !== 'string' || !url.trim()) {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Check protocol (only http/https allowed)
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Invalid URL protocol. Only http and https are allowed' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Check against blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'Access to internal hosts is not allowed' };
  }

  // Check for hostname patterns that could indicate internal access
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { valid: false, error: 'Access to internal hosts is not allowed' };
  }

  // Check if hostname is an IP address and validate against blocked ranges
  // This handles both direct IP access and numeric hostnames
  const isIpAddress = /^[\d.:a-fA-F]+$/.test(hostname) || 
                      /^\[[\da-fA-F:]+\]$/.test(hostname); // IPv6 in brackets

  if (isIpAddress) {
    // Remove brackets for IPv6
    const cleanIp = hostname.replace(/^\[|\]$/g, '');
    
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(cleanIp)) {
        return { valid: false, error: 'Access to internal IP addresses is not allowed' };
      }
    }
  }

  // Check for DNS rebinding attempts using numeric representations
  // e.g., 2130706433 = 127.0.0.1 in decimal
  if (/^\d+$/.test(hostname)) {
    const numericIp = parseInt(hostname, 10);
    // 127.0.0.0/8 in decimal: 2130706432 - 2147483647
    // 10.0.0.0/8 in decimal: 167772160 - 184549375
    // 172.16.0.0/12 in decimal: 2886729728 - 2887778303
    // 192.168.0.0/16 in decimal: 3232235520 - 3232301055
    // 169.254.0.0/16 in decimal: 2851995648 - 2852061183
    if (
      (numericIp >= 2130706432 && numericIp <= 2147483647) || // 127.x.x.x
      (numericIp >= 167772160 && numericIp <= 184549375) ||   // 10.x.x.x
      (numericIp >= 2886729728 && numericIp <= 2887778303) || // 172.16-31.x.x
      (numericIp >= 3232235520 && numericIp <= 3232301055) || // 192.168.x.x
      (numericIp >= 2851995648 && numericIp <= 2852061183) || // 169.254.x.x
      numericIp === 0 || numericIp === 4294967295            // 0.0.0.0 and 255.255.255.255
    ) {
      return { valid: false, error: 'Access to internal IP addresses is not allowed' };
    }
  }

  return { valid: true, url: parsedUrl.href };
}

/**
 * Fetches from a URL only after validating it is safe for server-side requests (SSRF protection).
 * Combines validateExternalUrl with fetch so user-provided URLs never reach fetch without validation.
 */
export async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  const validation = validateExternalUrl(url);
  if (!validation.valid || !validation.url) {
    throw new SSRFValidationError(validation.error || 'Invalid URL');
  }
  return fetch(validation.url, options);
}

/**
 * Validates that a string ID is safe to use in URLs (prevents path traversal)
 * Only allows alphanumeric characters, underscores, and hyphens
 */
export function validateSafeId(id: string): UrlValidationResult {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Invalid ID format' };
  }

  // Only allow alphanumeric, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { valid: false, error: 'ID contains invalid characters' };
  }

  // Prevent excessively long IDs
  if (id.length > 100) {
    return { valid: false, error: 'ID is too long' };
  }

  return { valid: true };
}

/**
 * Type-safe error message extraction
 * Handles Error objects, strings, and unknown types safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string') {
      return msg;
    }
  }
  return 'Unknown error';
}
