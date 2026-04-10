/**
 * Media Session Cache Service
 * Caches user extraction session data, preferences, and history
 * Used by extractor route for efficient per-user session management
 *
 * Security:
 * - Strict input validation
 * - Rate-limited history entries
 * - Memory bounds on cache sizes
 * - TTL-based expiration
 */

import { LRUCache } from 'lru-cache';

const MEDIA_SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const EXTRACTION_HISTORY_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Constants for validation and limits
const MAX_SESSION_USERS = 500; // Max concurrent user sessions
const MAX_HISTORY_USERS = 100; // Max users with history
const MAX_QUERIES_PER_SESSION = 50;
const MAX_HISTORY_PER_USER = 100;
const MAX_QUERY_LENGTH = 256;
const MAX_MODE_LENGTH = 32;

export interface MediaSessionUser {
  userId: string;
  lastActivity: number;
  extractionModes: ('google' | 'url' | 'instagram' | 'document')[];
  recentQueries: Array<{ query: string; mode: string; timestamp: number }>;
  preferences: {
    defaultLimit?: number;
    preferredImageFormat?: string;
    autoDownload?: boolean;
  };
}

const sessionCache = new LRUCache<string, MediaSessionUser>({
  max: MAX_SESSION_USERS,
  ttl: MEDIA_SESSION_TTL,
});

const extractionHistoryCache = new LRUCache<string, any[]>({
  max: MAX_HISTORY_USERS,
  ttl: EXTRACTION_HISTORY_TTL,
});

/**
 * Validate and sanitize user ID
 */
function validateUserId(userId: string): boolean {
  if (!userId || typeof userId !== 'string') return false;
  // Allow alphanumeric, dash, underscore (typical for user IDs)
  return /^[a-zA-Z0-9_-]{1,128}$/.test(userId);
}

/**
 * Validate and sanitize query string
 */
function validateQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  // Trim and limit length
  const sanitized = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (sanitized.length === 0) {
    throw new Error('Query cannot be empty');
  }
  return sanitized;
}

/**
 * Validate extraction mode
 */
function validateMode(mode: string): mode is 'google' | 'url' | 'instagram' | 'document' {
  if (!mode || typeof mode !== 'string') return false;
  const validModes = ['google', 'url', 'instagram', 'document'];
  return validModes.includes(mode.slice(0, MAX_MODE_LENGTH));
}

export const mediaSessionCache = {
  /**
   * Get or create user session
   * Validates userId before operating
   */
  getOrCreateSession(userId: string): MediaSessionUser {
    if (!validateUserId(userId)) {
      throw new Error('Invalid user ID format');
    }

    const existing = sessionCache.get(userId);
    if (existing) {
      existing.lastActivity = Date.now();
      return existing;
    }

    const newSession: MediaSessionUser = {
      userId,
      lastActivity: Date.now(),
      extractionModes: [],
      recentQueries: [],
      preferences: {
        defaultLimit: 40,
        preferredImageFormat: 'jpg',
        autoDownload: false,
      },
    };

    sessionCache.set(userId, newSession, { ttl: MEDIA_SESSION_TTL });
    return newSession;
  },

  /**
   * Track extraction query in user history
   * Validates inputs and enforces rate limits
   */
  trackQuery(userId: string, query: string, mode: string): void {
    if (!validateUserId(userId)) {
      throw new Error('Invalid user ID format');
    }

    const sanitizedQuery = validateQuery(query);
    if (!validateMode(mode)) {
      throw new Error(`Invalid extraction mode: ${mode}`);
    }

    const session = this.getOrCreateSession(userId);

    // Add mode if not already present
    if (!session.extractionModes.includes(mode)) {
      session.extractionModes.push(mode);
    }

    // Rate limit: enforce max queries per session
    if (session.recentQueries.length >= MAX_QUERIES_PER_SESSION) {
      session.recentQueries.pop();
    }

    session.recentQueries.unshift({
      query: sanitizedQuery,
      mode,
      timestamp: Date.now(),
    });
  },

  /**
   * Add to extraction history
   * Validates userId and enforces memory limits
   */
  addToHistory(userId: string, extraction: any): void {
    if (!validateUserId(userId)) {
      throw new Error('Invalid user ID format');
    }

    if (!extraction || typeof extraction !== 'object') {
      throw new Error('Invalid extraction data');
    }

    const key = `history-${userId}`;
    const history = extractionHistoryCache.get(key) || [];

    // Sanitize extraction data
    const sanitized = {
      type: String(extraction.type || 'unknown').slice(0, 32),
      query: String(extraction.query || '').slice(0, MAX_QUERY_LENGTH),
      mode: String(extraction.mode || '').slice(0, MAX_MODE_LENGTH),
      resultCount: Math.max(0, parseInt(extraction.resultCount) || 0),
      timestamp: Date.now(),
    };

    history.unshift(sanitized);

    // Enforce memory limit
    if (history.length > MAX_HISTORY_PER_USER) {
      history.pop();
    }

    extractionHistoryCache.set(key, history, { ttl: EXTRACTION_HISTORY_TTL });
  },

  /**
   * Get user extraction history
   * Validates userId and enforces query limits
   */
  getHistory(userId: string, limit: number = 20): any[] {
    if (!validateUserId(userId)) {
      throw new Error('Invalid user ID format');
    }

    // Enforce max limit (security: prevent large data extractions)
    const safeLimit = Math.min(Math.max(1, parseInt(String(limit)) || 20), 100);

    const key = `history-${userId}`;
    const history = extractionHistoryCache.get(key) || [];
    return history.slice(0, safeLimit);
  },

  /**
   * Update user preferences
   * Validates inputs and only allows known preference keys
   */
  updatePreferences(
    userId: string,
    prefs: Partial<MediaSessionUser['preferences']>
  ): void {
    if (!validateUserId(userId)) {
      throw new Error('Invalid user ID format');
    }

    if (!prefs || typeof prefs !== 'object') {
      throw new Error('Invalid preferences object');
    }

    const session = this.getOrCreateSession(userId);

    // Only allow known preference keys
    const allowed = {
      defaultLimit: prefs.defaultLimit ? Math.min(Math.max(10, parseInt(String(prefs.defaultLimit))), 100) : undefined,
      preferredImageFormat: prefs.preferredImageFormat ? String(prefs.preferredImageFormat).slice(0, 20) : undefined,
      autoDownload: typeof prefs.autoDownload === 'boolean' ? prefs.autoDownload : undefined,
    };

    session.preferences = { ...session.preferences, ...Object.fromEntries(
      Object.entries(allowed).filter(([, v]) => v !== undefined)
    )};
  },

  /**
   * Get user session (read-only)
   */
  getSession(userId: string): MediaSessionUser | undefined {
    if (!validateUserId(userId)) {
      return undefined;
    }
    return sessionCache.get(userId);
  },

  /**
   * Invalidate user session
   */
  invalidateSession(userId: string): void {
    if (validateUserId(userId)) {
      sessionCache.delete(userId);
    }
  },

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      activeSessions: sessionCache.size,
      historyEntries: extractionHistoryCache.size,
      sessionKeys: [...sessionCache.keys()],
    };
  },

  /**
   * Clear all caches
   */
  clearAll(): void {
    sessionCache.clear();
    extractionHistoryCache.clear();
  },
};
