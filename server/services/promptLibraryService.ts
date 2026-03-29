/**
 * Prompt Library Service
 *
 * Unified interface for prompt storage and retrieval.
 * Connects image-to-prompt generation with community library.
 */

import { getDb } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { ensureString, isSafeId } from '../utils/validation.js';

// ============ Types ============

export interface PromptEntry {
  id: string;
  name: string;
  prompt: string;
  category: 'ui-prompts' | 'figma-prompts' | string;
  tags: string[];
  sourceType: 'generated' | 'manual' | 'community';
  // Metadata
  componentType?: string; // chart, card, form, etc
  imageHash?: string; // For deduplication
  usageCount: number;
  rating: number; // Average rating from feedback
  // Ownership
  userId?: string;
  isPublic: boolean;
  isApproved: boolean;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface SavePromptOptions {
  name: string;
  prompt: string;
  category: string;
  tags?: string[];
  componentType?: string;
  userId?: string;
  isPublic?: boolean;
}

// ============ Core Functions ============

/**
 * Save a generated prompt to the library
 * @throws Error if validation fails
 */
export async function saveToLibrary(options: SavePromptOptions): Promise<string> {
  // Validate required fields
  const validName = ensureString(options.name, 200);
  const validPrompt = ensureString(options.prompt, 100000);
  const validCategory = ensureString(options.category, 50);

  if (!validName) throw new Error('Invalid name: must be string under 200 chars');
  if (!validPrompt) throw new Error('Invalid prompt: must be string under 100000 chars');
  if (!validCategory) throw new Error('Invalid category');

  // Validate optional componentType
  const validComponentType = options.componentType
    ? ensureString(options.componentType, 50) || undefined
    : undefined;

  // Validate tags (max 20 tags, each max 50 chars)
  const validTags = (options.tags || [])
    .slice(0, 20)
    .map(t => ensureString(t, 50))
    .filter((t): t is string => t !== null);

  const db = await getDb();
  const collection = db.collection('community_presets');

  const id = `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // If isPublic is true (admin publishing), auto-approve
  const isPublic = options.isPublic ?? false;

  const entry: PromptEntry = {
    id,
    name: validName,
    prompt: validPrompt,
    category: validCategory,
    tags: validTags,
    sourceType: 'generated',
    componentType: validComponentType,
    usageCount: 0,
    rating: 2.5, // Start with neutral rating
    userId: options.userId,
    isPublic,
    isApproved: isPublic, // Auto-approve if admin publishes
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await collection.insertOne({
    ...entry,
    userId: options.userId ? new ObjectId(options.userId) : undefined,
  });

  return id;
}

/**
 * Find similar prompts from library
 * Uses tags and componentType for matching
 */
export async function findSimilar(
  componentType?: string,
  tags?: string[],
  limit: number = 5
): Promise<PromptEntry[]> {
  const db = await getDb();
  const collection = db.collection('community_presets');

  const query: any = {
    isApproved: true,
    category: { $in: ['ui-prompts', 'figma-prompts'] },
  };

  if (componentType) {
    query.componentType = componentType;
  }

  if (tags?.length) {
    query.tags = { $in: tags };
  }

  const results = await collection
    .find(query)
    .sort({ rating: -1, usageCount: -1 })
    .limit(limit)
    .toArray();

  return results as unknown as PromptEntry[];
}

/**
 * Get top prompts by category for inspiration
 */
export async function getTopPrompts(
  category: string,
  limit: number = 10
): Promise<PromptEntry[]> {
  const db = await getDb();
  const collection = db.collection('community_presets');

  const results = await collection
    .find({
      category,
      isApproved: true,
      isPublic: true,
    })
    .sort({ rating: -1, usageCount: -1 })
    .limit(limit)
    .toArray();

  return results as unknown as PromptEntry[];
}

/**
 * Increment usage count when prompt is used
 */
export async function incrementUsage(promptId: string): Promise<void> {
  if (!isSafeId(promptId, 50)) {
    throw new Error('Invalid prompt ID');
  }

  const db = await getDb();
  const collection = db.collection('community_presets');

  await collection.updateOne(
    { id: promptId },
    {
      $inc: { usageCount: 1 },
      $set: { updatedAt: new Date() },
    }
  );
}

/**
 * Update rating based on feedback
 */
export async function updateRating(
  promptId: string,
  success: boolean
): Promise<void> {
  if (!isSafeId(promptId, 50)) {
    throw new Error('Invalid prompt ID');
  }

  const db = await getDb();
  const collection = db.collection('community_presets');

  // Simple rating: +0.1 for success, -0.1 for failure, clamped 0-5
  const delta = success ? 0.1 : -0.1;

  const doc = await collection.findOne({ id: promptId });
  if (!doc) return;

  const newRating = Math.max(0, Math.min(5, (doc.rating || 2.5) + delta));

  await collection.updateOne(
    { id: promptId },
    { $set: { rating: newRating, updatedAt: new Date() } }
  );
}

/**
 * Get user's saved prompts
 */
export async function getUserPrompts(
  userId: string,
  category?: string
): Promise<PromptEntry[]> {
  const db = await getDb();
  const collection = db.collection('community_presets');

  const query: any = {
    userId: new ObjectId(userId),
    sourceType: 'generated',
  };

  if (category) {
    query.category = category;
  }

  const results = await collection
    .find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return results as unknown as PromptEntry[];
}

/**
 * Build context from similar prompts for better generation
 */
export async function buildLibraryContext(
  componentType?: string,
  tags?: string[]
): Promise<string | null> {
  const similar = await findSimilar(componentType, tags, 3);

  if (similar.length === 0) return null;

  const examples = similar
    .map((p, i) => `${i + 1}. [${p.componentType || 'ui'}] ${p.prompt.slice(0, 200)}...`)
    .join('\n');

  return `EXEMPLOS DA BIBLIOTECA (use como referência):\n${examples}`;
}
