import { connectToMongoDB, getDb } from '../db/mongodb.js';

/**
 * Interface for all available tags organized by category
 */
export interface AvailableTags {
  branding: string[];
  categories: string[];
  locations: string[];
  angles: string[];
  lighting: string[];
  effects: string[];
  materials: string[];
}

/**
 * Cache configuration
 */
interface CacheEntry {
  tags: AvailableTags;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache: CacheEntry | null = null;

/**
 * Collection names mapped to tag categories
 */
const COLLECTION_MAP = {
  branding: 'branding_presets',
  categories: 'mockup_presets',
  locations: 'ambience_presets',
  angles: 'angle_presets',
  lighting: 'luminance_presets',
  effects: 'effect_presets',
  materials: 'texture_presets',
} as const;

/**
 * Fetches all available tags from MongoDB collections
 * Uses cache with TTL to reduce database queries
 * 
 * @returns Promise resolving to AvailableTags object
 */
export async function getAllAvailableTags(): Promise<AvailableTags> {
  // Check cache first
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.tags;
  }

  try {
    await connectToMongoDB();
    const db = getDb();

    // Fetch all collections in parallel
    const [
      brandingDocs,
      mockupDocs,
      locationDocs,
      angleDocs,
      lightingDocs,
      effectDocs,
      textureDocs,
    ] = await Promise.all([
      db.collection(COLLECTION_MAP.branding).find({}, { projection: { name: 1 } }).toArray(),
      db.collection(COLLECTION_MAP.categories).find({}, { projection: { name: 1 } }).toArray(),
      db.collection(COLLECTION_MAP.locations).find({}, { projection: { name: 1 } }).toArray(),
      db.collection(COLLECTION_MAP.angles).find({}, { projection: { name: 1 } }).toArray(),
      db.collection(COLLECTION_MAP.lighting).find({}, { projection: { name: 1 } }).toArray(),
      db.collection(COLLECTION_MAP.effects).find({}, { projection: { name: 1 } }).toArray(),
      db.collection(COLLECTION_MAP.materials).find({}, { projection: { name: 1 } }).toArray(),
    ]);

    const tags: AvailableTags = {
      branding: brandingDocs.map(d => d.name),
      categories: [...new Set(mockupDocs.map(d => d.name))], // Remove duplicates
      locations: locationDocs.map(d => d.name),
      angles: angleDocs.map(d => d.name),
      lighting: lightingDocs.map(d => d.name),
      effects: effectDocs.map(d => d.name),
      materials: textureDocs.map(d => d.name),
    };

    // Update cache
    cache = {
      tags,
      timestamp: Date.now(),
    };

    return tags;
  } catch (error) {
    console.error('Error fetching available tags:', error);
    // Return empty tags on error (fallback)
    return {
      branding: [],
      categories: [],
      locations: [],
      angles: [],
      lighting: [],
      effects: [],
      materials: [],
    };
  }
}

/**
 * Validates and filters suggested tags against available tags
 * Performs case-insensitive matching and optional fuzzy matching
 * 
 * @param suggestedTags - Tags suggested by AI
 * @param availableTags - Available tags from database
 * @param options - Validation options
 * @returns Validated tags with same structure as suggestedTags
 */
export function validateTags(
  suggestedTags: Partial<AvailableTags>,
  availableTags: AvailableTags,
  options: {
    fuzzyMatching?: boolean;
    logInvalid?: boolean;
  } = {}
): Partial<AvailableTags> {
  const { fuzzyMatching = false, logInvalid = true } = options;
  const validated: Partial<AvailableTags> = {};

  // Helper function to find matching tag
  const findMatch = (suggested: string, available: string[]): string | null => {
    // Exact match (case-insensitive)
    const exactMatch = available.find(
      tag => tag.toLowerCase() === suggested.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Fuzzy matching (if enabled)
    if (fuzzyMatching) {
      const normalizedSuggested = suggested.toLowerCase().trim();
      const fuzzyMatch = available.find(tag => {
        const normalizedTag = tag.toLowerCase().trim();
        // Check if one contains the other (for cases like "Minimalist" vs "Minimal")
        return normalizedTag.includes(normalizedSuggested) ||
               normalizedSuggested.includes(normalizedTag) ||
               // Check similarity (simple Levenshtein-like check for short strings)
               (normalizedTag.length <= 15 && normalizedSuggested.length <= 15 &&
                calculateSimilarity(normalizedTag, normalizedSuggested) > 0.7);
      });
      if (fuzzyMatch) return fuzzyMatch;
    }

    return null;
  };

  // Validate each category
  const categories: (keyof AvailableTags)[] = [
    'branding',
    'categories',
    'locations',
    'angles',
    'lighting',
    'effects',
    'materials',
  ];

  for (const category of categories) {
    const suggested = suggestedTags[category];
    if (!suggested || !Array.isArray(suggested)) {
      continue;
    }

    const available = availableTags[category];
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const tag of suggested) {
      const match = findMatch(tag, available);
      if (match) {
        valid.push(match);
      } else {
        invalid.push(tag);
      }
    }

    if (valid.length > 0) {
      validated[category] = valid;
    }

    if (logInvalid && invalid.length > 0) {
      console.warn(`[TagService] Invalid ${category} tags suggested by AI:`, invalid);
    }
  }

  return validated;
}

/**
 * Simple similarity calculation (0-1 scale)
 * Used for fuzzy matching of tag names
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Clears the tag cache
 * Useful when tags are updated in the database
 */
export function clearTagCache(): void {
  cache = null;
}
