import { describe, it, expect } from 'vitest';
import {
  ensureString,
  ensureOptionalBoolean,
  isValidAspectRatio,
  VALID_ASPECT_RATIOS,
  isSafeId,
  isValidObjectId,
} from './validation.js';

describe('Validation Helpers', () => {
  describe('ensureString', () => {
    it('should accept valid string', () => {
      expect(ensureString('hello')).toBe('hello');
    });

    it('should accept empty string', () => {
      expect(ensureString('')).toBe('');
    });

    it('should reject null', () => {
      expect(ensureString(null)).toBe(null);
    });

    it('should reject undefined', () => {
      expect(ensureString(undefined)).toBe(null);
    });

    it('should reject number', () => {
      expect(ensureString(123)).toBe(null);
    });

    it('should reject object (prevents $set injection)', () => {
      expect(ensureString({ $gt: '' })).toBe(null);
    });

    it('should reject array', () => {
      expect(ensureString(['a'])).toBe(null);
    });

    it('should reject string over maxLen', () => {
      expect(ensureString('xy', 1)).toBe(null);
    });

    it('should accept string within maxLen', () => {
      expect(ensureString('x', 2)).toBe('x');
    });
  });

  describe('ensureOptionalBoolean', () => {
    it('should accept true', () => {
      expect(ensureOptionalBoolean(true)).toBe(true);
    });

    it('should accept false', () => {
      expect(ensureOptionalBoolean(false)).toBe(false);
    });

    it('should return undefined for undefined', () => {
      expect(ensureOptionalBoolean(undefined)).toBe(undefined);
    });

    it('should return undefined for null', () => {
      expect(ensureOptionalBoolean(null)).toBe(undefined);
    });

    it('should reject number', () => {
      expect(ensureOptionalBoolean(1)).toBe(undefined);
    });

    it('should reject string', () => {
      expect(ensureOptionalBoolean('true')).toBe(undefined);
    });
  });

  describe('isValidAspectRatio', () => {
    it('should accept 16:9', () => {
      expect(isValidAspectRatio('16:9')).toBe(true);
    });

    it('should accept 1:1', () => {
      expect(isValidAspectRatio('1:1')).toBe(true);
    });

    it('should reject invalid aspect ratio', () => {
      expect(isValidAspectRatio('invalid')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidAspectRatio('')).toBe(false);
    });

    it('should reject non-string', () => {
      expect(isValidAspectRatio({ $gt: '' } as any)).toBe(false);
    });

    it('should have 16:9 in VALID_ASPECT_RATIOS', () => {
      expect(VALID_ASPECT_RATIOS).toContain('16:9');
    });
  });

  describe('isSafeId', () => {
    it('should accept alphanumeric, hyphen, underscore', () => {
      expect(isSafeId('abc-123_x')).toBe(true);
    });

    it('should accept short id', () => {
      expect(isSafeId('a')).toBe(true);
    });

    it('should reject empty id', () => {
      expect(isSafeId('')).toBe(false);
    });

    it('should reject dangerous chars', () => {
      expect(isSafeId('a; DROP TABLE--')).toBe(false);
    });

    it('should reject id over maxLen', () => {
      expect(isSafeId('x'.repeat(101))).toBe(false);
    });
  });

  describe('isValidObjectId', () => {
    it('should accept 24-char hex', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
    });

    it('should reject non-hex', () => {
      expect(isValidObjectId('invalid')).toBe(false);
    });

    it('should reject short string', () => {
      expect(isValidObjectId('123')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidObjectId('')).toBe(false);
    });
  });
});
