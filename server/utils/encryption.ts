import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is the recommended IV length
const SALT_LENGTH = 64; // 64 bytes for the salt
const TAG_LENGTH = 16; // GCM authentication tag length
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Get the encryption key from environment variable
 * Derives a consistent key from the master key using PBKDF2
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.API_KEY_ENCRYPTION_KEY;
  
  if (!masterKey) {
    throw new Error(
      'API_KEY_ENCRYPTION_KEY environment variable is not set. ' +
      'This is required for encrypting user API keys.'
    );
  }

  // Use PBKDF2 to derive a consistent 32-byte key from the master key
  // Using a fixed salt based on the app name to ensure consistency
  const salt = crypto.createHash('sha256')
    .update('vsn-mockup-machine-api-key-encryption')
    .digest();
  
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt an API key using AES-256-GCM
 * @param apiKey - The plaintext API key to encrypt
 * @returns The encrypted key as a hex string (format: iv:tag:encrypted)
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key cannot be empty');
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Return format: iv:tag:encrypted (all in hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (error: any) {
    throw new Error(`Failed to encrypt API key: ${error.message}`);
  }
}

/**
 * Decrypt an API key using AES-256-GCM
 * @param encryptedApiKey - The encrypted API key (format: iv:tag:encrypted)
 * @returns The decrypted plaintext API key
 */
export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey || encryptedApiKey.trim().length === 0) {
    throw new Error('Encrypted API key cannot be empty');
  }

  try {
    const key = getEncryptionKey();
    
    // Parse the format: iv:tag:encrypted
    const parts = encryptedApiKey.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted API key format');
    }
    
    const [ivHex, tagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    // Don't leak specific error details in production
    throw new Error(`Failed to decrypt API key: ${error.message}`);
  }
}











