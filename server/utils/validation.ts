/**
 * Centralized validation utilities for security
 * - Safe email validation (ReDoS-resistant)
 * - MongoDB ObjectId validation
 * - MongoDB query sanitization (NoSQL injection prevention)
 * - Log value sanitization
 */

import { ObjectId } from 'mongodb';

/**
 * RFC 5322 compliant email regex that is ReDoS-resistant
 * Uses possessive quantifiers pattern to prevent catastrophic backtracking
 * Max email length: 254 characters (RFC 5321)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validates email format using ReDoS-resistant regex
 * @param email - Email address to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  // RFC 5321 max email length
  if (email.length > 254) return false;
  
  // Local part max length is 64 characters
  const atIndex = email.indexOf('@');
  if (atIndex > 64) return false;
  
  return EMAIL_REGEX.test(email);
}

/**
 * Validates MongoDB ObjectId format
 * Checks both validity and string representation consistency
 * @param id - String to validate as ObjectId
 * @returns true if valid ObjectId
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  
  // ObjectId is exactly 24 hex characters
  if (!/^[a-fA-F0-9]{24}$/.test(id)) return false;
  
  // Verify it's a valid ObjectId that round-trips correctly
  try {
    return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
  } catch {
    return false;
  }
}

/**
 * Validates a string ID for safe use in URLs and queries
 * Only allows alphanumeric, hyphens, and underscores
 * @param id - String to validate
 * @param maxLength - Maximum allowed length (default 100)
 * @returns true if safe ID format
 */
export function isSafeId(id: string, maxLength = 100): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length > maxLength) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Sanitizes an object for safe use in MongoDB queries
 * Removes keys starting with $ to prevent operator injection
 * @param obj - Object to sanitize
 * @returns Sanitized object safe for MongoDB queries
 */
export function sanitizeMongoQuery<T extends Record<string, unknown>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return {} as Partial<T>;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip keys starting with $ (MongoDB operators)
    if (key.startsWith('$')) {
      continue;
    }

    // Skip prototype pollution attempts
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Check if nested object contains any $ operators
      const nestedObj = value as Record<string, unknown>;
      const hasOperators = Object.keys(nestedObj).some(k => k.startsWith('$'));
      
      if (!hasOperators) {
        sanitized[key] = sanitizeMongoQuery(nestedObj);
      }
      // Skip objects with operators entirely
    } else if (Array.isArray(value)) {
      // For arrays, sanitize each element if it's an object
      sanitized[key] = value.map(item => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          return sanitizeMongoQuery(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      // Primitive values are safe
      sanitized[key] = value;
    }
  }

  return sanitized as Partial<T>;
}

/**
 * Sanitizes a value for safe logging
 * Truncates long strings and removes sensitive patterns
 * @param value - Value to sanitize for logging
 * @param maxLength - Maximum string length (default 200)
 * @returns Sanitized value safe for logging
 */
export function sanitizeLogValue(value: unknown, maxLength = 200): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  
  if (typeof value === 'string') {
    // Remove potential sensitive data patterns
    let sanitized = value
      .replace(/password['":\s]*['"]?[^'"}\s,]+/gi, 'password:[REDACTED]')
      .replace(/token['":\s]*['"]?[^'"}\s,]+/gi, 'token:[REDACTED]')
      .replace(/api[_-]?key['":\s]*['"]?[^'"}\s,]+/gi, 'apiKey:[REDACTED]')
      .replace(/secret['":\s]*['"]?[^'"}\s,]+/gi, 'secret:[REDACTED]');
    
    // Truncate long strings
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...[truncated]';
    }
    
    return sanitized;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value);
      if (str.length > maxLength) {
        return str.substring(0, maxLength) + '...[truncated]';
      }
      return str;
    } catch {
      return '[Object]';
    }
  }
  
  return String(value);
}

/**
 * Validates that a value is a positive integer within bounds
 * @param value - Value to validate
 * @param min - Minimum allowed value (default 1)
 * @param max - Maximum allowed value (default Number.MAX_SAFE_INTEGER)
 * @returns true if valid positive integer
 */
export function isValidPositiveInt(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): boolean {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return false;
    return Number.isInteger(parsed) && parsed >= min && parsed <= max;
  }
  
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= min && value <= max;
  }
  
  return false;
}

/**
 * Extracts allowed fields from an object (whitelist approach)
 * @param obj - Source object
 * @param allowedFields - Array of allowed field names
 * @returns Object containing only allowed fields
 */
export function pickAllowedFields<T extends Record<string, unknown>>(
  obj: T,
  allowedFields: (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {};
  
  for (const field of allowedFields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }
  
  return result;
}
