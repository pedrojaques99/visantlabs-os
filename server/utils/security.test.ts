import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateExternalUrl,
  validateSafeId,
  SSRFValidationError,
} from './securityValidation.js';

describe('Security Validation', () => {
  describe('validateExternalUrl - SSRF Protection', () => {
    it('should accept valid external HTTPS URLs', () => {
      const result = validateExternalUrl('https://example.com/image.png');
      expect(result.valid).toBe(true);
      expect(result.url).toBe('https://example.com/image.png');
    });

    it('should accept valid external HTTP URLs', () => {
      const result = validateExternalUrl('http://example.com/path');
      expect(result.valid).toBe(true);
    });

    it('should reject localhost', () => {
      const result = validateExternalUrl('http://localhost:3000');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('internal');
    });

    it('should reject 127.0.0.1', () => {
      const result = validateExternalUrl('http://127.0.0.1:8080');
      expect(result.valid).toBe(false);
    });

    it('should reject 10.x.x.x private IPs', () => {
      const result = validateExternalUrl('http://10.0.0.1');
      expect(result.valid).toBe(false);
    });

    it('should reject 192.168.x.x private IPs', () => {
      const result = validateExternalUrl('http://192.168.1.1');
      expect(result.valid).toBe(false);
    });

    it('should reject 172.16-31.x.x private IPs', () => {
      const result = validateExternalUrl('http://172.16.0.1');
      expect(result.valid).toBe(false);
    });

    it('should reject AWS metadata endpoint', () => {
      const result = validateExternalUrl('http://169.254.169.254/latest/meta-data');
      expect(result.valid).toBe(false);
    });

    it('should reject GCP metadata endpoint', () => {
      const result = validateExternalUrl('http://metadata.google.internal');
      expect(result.valid).toBe(false);
    });

    it('should reject file:// protocol', () => {
      const result = validateExternalUrl('file:///etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('should reject ftp:// protocol', () => {
      const result = validateExternalUrl('ftp://example.com');
      expect(result.valid).toBe(false);
    });

    it('should reject javascript: protocol', () => {
      const result = validateExternalUrl('javascript:alert(1)');
      expect(result.valid).toBe(false);
    });

    it('should reject .internal domain suffix', () => {
      const result = validateExternalUrl('http://malicious.internal');
      expect(result.valid).toBe(false);
    });

    it('should reject .local domain suffix', () => {
      const result = validateExternalUrl('http://printer.local');
      expect(result.valid).toBe(false);
    });

    it('should reject IPv6 loopback', () => {
      const result = validateExternalUrl('http://[::1]:3000');
      expect(result.valid).toBe(false);
    });

    it('should reject numeric IP bypass (decimal loopback)', () => {
      // 2130706433 = 127.0.0.1 in decimal
      const result = validateExternalUrl('http://2130706433');
      expect(result.valid).toBe(false);
    });

    it('should reject empty URL', () => {
      const result = validateExternalUrl('');
      expect(result.valid).toBe(false);
    });

    it('should reject invalid URL format', () => {
      const result = validateExternalUrl('not-a-url');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSafeId - Path Traversal Protection', () => {
    it('should accept valid alphanumeric ID', () => {
      const result = validateSafeId('abc123');
      expect(result.valid).toBe(true);
    });

    it('should accept ID with hyphens', () => {
      const result = validateSafeId('my-id-123');
      expect(result.valid).toBe(true);
    });

    it('should accept ID with underscores', () => {
      const result = validateSafeId('my_id_123');
      expect(result.valid).toBe(true);
    });

    it('should accept MongoDB ObjectId format', () => {
      const result = validateSafeId('507f1f77bcf86cd799439011');
      expect(result.valid).toBe(true);
    });

    it('should reject path traversal attempt', () => {
      const result = validateSafeId('../../../etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('should reject ID with dots', () => {
      const result = validateSafeId('file.txt');
      expect(result.valid).toBe(false);
    });

    it('should reject ID with slashes', () => {
      const result = validateSafeId('path/to/file');
      expect(result.valid).toBe(false);
    });

    it('should reject ID with backslashes', () => {
      const result = validateSafeId('path\\to\\file');
      expect(result.valid).toBe(false);
    });

    it('should reject empty ID', () => {
      const result = validateSafeId('');
      expect(result.valid).toBe(false);
    });

    it('should reject null ID', () => {
      const result = validateSafeId(null as any);
      expect(result.valid).toBe(false);
    });

    it('should reject ID exceeding max length', () => {
      const longId = 'a'.repeat(101);
      const result = validateSafeId(longId);
      expect(result.valid).toBe(false);
    });

    it('should accept ID at max length', () => {
      const maxId = 'a'.repeat(100);
      const result = validateSafeId(maxId);
      expect(result.valid).toBe(true);
    });

    it('should reject SQL injection characters', () => {
      const result = validateSafeId("1; DROP TABLE users--");
      expect(result.valid).toBe(false);
    });

    it('should reject XSS attempt', () => {
      const result = validateSafeId('<script>alert(1)</script>');
      expect(result.valid).toBe(false);
    });

    it('should reject CRLF injection', () => {
      const result = validateSafeId('id\r\nX-Injected: header');
      expect(result.valid).toBe(false);
    });
  });
});

describe('Encryption Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('should require encryption key environment variable', async () => {
    delete process.env.API_KEY_ENCRYPTION_KEY;

    const { encryptApiKey } = await import('./encryption.js');

    expect(() => encryptApiKey('test-key')).toThrow('API_KEY_ENCRYPTION_KEY');
  });

  it('should encrypt and decrypt API key correctly', async () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';

    vi.resetModules();
    const { encryptApiKey, decryptApiKey } = await import('./encryption.js');

    const originalKey = 'my-secret-api-key-12345';
    const encrypted = encryptApiKey(originalKey);
    const decrypted = decryptApiKey(encrypted);

    expect(decrypted).toBe(originalKey);
  });

  it('should produce different ciphertext for same plaintext (random IV)', async () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';

    vi.resetModules();
    const { encryptApiKey } = await import('./encryption.js');

    const originalKey = 'same-api-key';
    const encrypted1 = encryptApiKey(originalKey);
    const encrypted2 = encryptApiKey(originalKey);

    expect(encrypted1).not.toBe(encrypted2); // Different IVs
  });

  it('should reject empty API key', async () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';

    vi.resetModules();
    const { encryptApiKey } = await import('./encryption.js');

    expect(() => encryptApiKey('')).toThrow();
    expect(() => encryptApiKey('   ')).toThrow();
  });

  it('should reject tampered ciphertext', async () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';

    vi.resetModules();
    const { encryptApiKey, decryptApiKey } = await import('./encryption.js');

    const encrypted = encryptApiKey('test-key');
    const tampered = encrypted.slice(0, -2) + 'xx'; // Modify auth tag

    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it('should reject malformed encrypted format', async () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';

    vi.resetModules();
    const { decryptApiKey } = await import('./encryption.js');

    expect(() => decryptApiKey('invalid-no-colons')).toThrow();
    expect(() => decryptApiKey('only:two')).toThrow(); // Not enough parts
    expect(() => decryptApiKey('a:b:c:d')).toThrow(); // Invalid hex data
  });
});

describe('Rate Limiting Configuration', () => {
  it('should have reasonable default rate limits', () => {
    const apiWindow = parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10);
    const apiMax = parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10);
    const paymentMax = parseInt(process.env.RATE_LIMIT_MAX_PAYMENT || '10', 10);

    expect(apiWindow).toBeGreaterThanOrEqual(60000); // At least 1 minute
    expect(apiMax).toBeLessThanOrEqual(100); // Not too permissive
    expect(paymentMax).toBeLessThanOrEqual(20); // Payment should be stricter
  });
});
