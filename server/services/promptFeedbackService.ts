/**
 * Prompt Feedback Service
 *
 * Persists and retrieves feedback to improve prompt generation.
 * Learns from user corrections to generate better prompts over time.
 */

import { getDb } from '../db/mongodb.js';
import type { Collection, Document } from 'mongodb';
import { ensureString, isSafeId } from '../utils/validation.js';

// ============ Types ============

export interface PromptFeedback {
  _id?: string;
  feedbackId: string;
  componentType: string;
  success: boolean;
  improvement?: string;
  // Context for learning
  generatedPrompt?: string;
  imageHash?: string; // For deduplication
  timestamp: Date;
  // Extracted learnings (processed)
  learning?: string;
  confidence: number; // 0-1, increases with similar feedback
}

export interface Learning {
  type: 'do' | 'dont';
  rule: string;
  confidence: number;
  count: number;
}

// ============ Collection Access ============

async function getCollection(): Promise<Collection<PromptFeedback>> {
  const db = await getDb();
  return db.collection<PromptFeedback>('prompt_feedback');
}

// ============ Core Functions ============

/**
 * Save feedback to MongoDB
 * @throws Error if validation fails
 */
export async function saveFeedback(feedback: {
  feedbackId: string;
  componentType: string;
  success: boolean;
  improvement?: string;
  generatedPrompt?: string;
}): Promise<void> {
  // Validate inputs
  if (!isSafeId(feedback.feedbackId, 100)) {
    throw new Error('Invalid feedbackId');
  }
  const validComponentType = ensureString(feedback.componentType, 50);
  if (!validComponentType) {
    throw new Error('Invalid componentType');
  }
  const validImprovement = feedback.improvement
    ? ensureString(feedback.improvement, 2000)
    : undefined;
  const validPrompt = feedback.generatedPrompt
    ? ensureString(feedback.generatedPrompt, 10000)
    : undefined;

  const collection = await getCollection();

  // Extract learning from improvement text
  const learning = validImprovement
    ? extractLearning(validImprovement, feedback.success)
    : undefined;

  await collection.insertOne({
    feedbackId: feedback.feedbackId,
    componentType: validComponentType,
    success: feedback.success,
    improvement: validImprovement,
    generatedPrompt: validPrompt,
    timestamp: new Date(),
    learning,
    confidence: 0.5, // Initial confidence
  });

  // Update confidence of similar learnings
  if (learning) {
    await updateConfidence(validComponentType, learning, feedback.success);
  }

  console.log(`[PromptFeedback] Saved: ${feedback.success ? '✓' : '✗'} ${validComponentType}`);
}

/**
 * Extract actionable learning from user improvement text
 */
function extractLearning(improvement: string, success: boolean): string {
  const prefix = success ? 'DO:' : 'DONT:';
  // Clean and format
  const cleaned = improvement
    .trim()
    .replace(/^(não|don't|nao|dont)\s+/i, '')
    .replace(/\.$/, '');
  return `${prefix} ${cleaned}`;
}

/**
 * Update confidence of similar learnings
 */
async function updateConfidence(
  componentType: string,
  learning: string,
  success: boolean
): Promise<void> {
  const collection = await getCollection();

  // Find similar learnings (same component type, similar text)
  const similar = await collection.find({
    componentType,
    success,
    learning: { $exists: true },
  }).toArray();

  // Increase confidence for learnings that match
  for (const doc of similar) {
    if (doc.learning && isSimilarLearning(doc.learning, learning)) {
      const newConfidence = Math.min(1, (doc.confidence || 0.5) + 0.1);
      await collection.updateOne(
        { _id: doc._id },
        { $set: { confidence: newConfidence } }
      );
    }
  }
}

/**
 * Check if two learnings are similar (simple keyword overlap)
 */
function isSimilarLearning(a: string, b: string): boolean {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word) && word.length > 3) overlap++;
  }
  return overlap >= 2;
}

/**
 * Get learnings for a component type, sorted by confidence
 */
export async function getLearnings(
  componentType: string,
  limit: number = 10
): Promise<Learning[]> {
  const collection = await getCollection();

  // Aggregate learnings by similarity and confidence
  const results = await collection.aggregate<{
    _id: { learning: string; success: boolean };
    count: number;
    avgConfidence: number;
  }>([
    {
      $match: {
        componentType,
        learning: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: { learning: '$learning', success: '$success' },
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' },
      },
    },
    {
      $sort: { avgConfidence: -1, count: -1 },
    },
    {
      $limit: limit,
    },
  ]).toArray();

  return results.map(r => ({
    type: r._id.success ? 'do' : 'dont',
    rule: r._id.learning,
    confidence: r.avgConfidence,
    count: r.count,
  }));
}

/**
 * Build learning context for system prompt
 * Returns formatted string to inject into prompt
 */
export async function buildLearningContext(
  componentType: string
): Promise<string | null> {
  const learnings = await getLearnings(componentType, 8);

  if (learnings.length === 0) {
    // Try general learnings if no specific ones
    const generalLearnings = await getLearnings('general', 5);
    if (generalLearnings.length === 0) return null;
    return formatLearnings(generalLearnings);
  }

  return formatLearnings(learnings);
}

/**
 * Format learnings for prompt injection
 */
function formatLearnings(learnings: Learning[]): string {
  const dos = learnings
    .filter(l => l.type === 'do' && l.confidence >= 0.6)
    .map(l => `✓ ${l.rule.replace('DO: ', '')}`)
    .slice(0, 4);

  const donts = learnings
    .filter(l => l.type === 'dont' && l.confidence >= 0.6)
    .map(l => `✗ ${l.rule.replace('DONT: ', '')}`)
    .slice(0, 4);

  if (dos.length === 0 && donts.length === 0) return '';

  const lines: string[] = ['APRENDIZADOS DE FEEDBACK:'];
  if (dos.length > 0) lines.push(...dos);
  if (donts.length > 0) lines.push(...donts);

  return lines.join('\n');
}

/**
 * Get feedback stats for dashboard
 */
export async function getFeedbackStats(): Promise<{
  total: number;
  positive: number;
  negative: number;
  byType: Record<string, { positive: number; negative: number }>;
}> {
  const collection = await getCollection();

  const stats = await collection.aggregate([
    {
      $group: {
        _id: { componentType: '$componentType', success: '$success' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  let total = 0;
  let positive = 0;
  let negative = 0;
  const byType: Record<string, { positive: number; negative: number }> = {};

  for (const stat of stats) {
    const count = stat.count;
    total += count;

    if (stat._id.success) {
      positive += count;
    } else {
      negative += count;
    }

    const type = stat._id.componentType || 'unknown';
    if (!byType[type]) byType[type] = { positive: 0, negative: 0 };
    if (stat._id.success) {
      byType[type].positive += count;
    } else {
      byType[type].negative += count;
    }
  }

  return { total, positive, negative, byType };
}

/**
 * Create indexes for efficient queries
 */
export async function ensureIndexes(): Promise<void> {
  const collection = await getCollection();
  await collection.createIndex({ componentType: 1, confidence: -1 });
  await collection.createIndex({ feedbackId: 1 }, { unique: true });
  await collection.createIndex({ timestamp: -1 });
}
