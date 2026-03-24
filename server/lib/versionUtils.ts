/**
 * Version Utilities for Brand Guidelines
 *
 * Helpers for version tracking, change detection, and diff generation.
 */

import type { BrandGuideline } from '../../src/lib/figma-types.js';

// Fields to track for change detection
const TRACKABLE_FIELDS = [
  'identity',
  'logos',
  'colors',
  'typography',
  'tags',
  'media',
  'tokens',
  'guidelines',
  'folder',
] as const;

type TrackableField = (typeof TRACKABLE_FIELDS)[number];

/**
 * Calculate which fields changed between two guideline states
 */
export function calculateChangedFields(
  oldData: Partial<BrandGuideline>,
  newData: Partial<BrandGuideline>
): string[] {
  const changedFields: string[] = [];

  for (const field of TRACKABLE_FIELDS) {
    const oldValue = oldData[field as keyof BrandGuideline];
    const newValue = newData[field as keyof BrandGuideline];

    // Compare JSON stringified values for deep comparison
    const oldJson = JSON.stringify(oldValue ?? null);
    const newJson = JSON.stringify(newValue ?? null);

    if (oldJson !== newJson) {
      changedFields.push(field);
    }
  }

  return changedFields;
}

/**
 * Generate a human-readable change note from changed fields
 */
export function generateChangeNote(changedFields: string[]): string {
  if (changedFields.length === 0) return 'No changes';
  if (changedFields.length === 1) {
    return `Updated ${formatFieldName(changedFields[0])}`;
  }
  if (changedFields.length === 2) {
    return `Updated ${formatFieldName(changedFields[0])} and ${formatFieldName(changedFields[1])}`;
  }
  return `Updated ${changedFields.length} sections`;
}

/**
 * Format field name for display
 */
function formatFieldName(field: string): string {
  const names: Record<string, string> = {
    identity: 'brand identity',
    logos: 'logos',
    colors: 'colors',
    typography: 'typography',
    tags: 'tags',
    media: 'media kit',
    tokens: 'design tokens',
    guidelines: 'editorial guidelines',
    folder: 'folder',
  };
  return names[field] || field;
}

/**
 * Create a snapshot of guideline data for versioning
 */
export function createSnapshot(guideline: Partial<BrandGuideline>): Record<string, unknown> {
  // Only include trackable fields (exclude metadata like id, userId, dates)
  const snapshot: Record<string, unknown> = {};

  for (const field of TRACKABLE_FIELDS) {
    const value = guideline[field as keyof BrandGuideline];
    if (value !== undefined && value !== null) {
      snapshot[field] = JSON.parse(JSON.stringify(value)); // Deep clone
    }
  }

  // Also include some UI preferences
  if (guideline.activeSections) {
    snapshot.activeSections = guideline.activeSections;
  }

  return snapshot;
}

/**
 * Generate a diff between two snapshots
 */
export function generateDiff(
  oldSnapshot: Record<string, unknown>,
  newSnapshot: Record<string, unknown>
): Record<string, { added?: unknown[]; removed?: unknown[]; changed?: unknown }> {
  const diff: Record<string, { added?: unknown[]; removed?: unknown[]; changed?: unknown }> = {};

  for (const field of TRACKABLE_FIELDS) {
    const oldValue = oldSnapshot[field];
    const newValue = newSnapshot[field];

    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      continue; // No change
    }

    // Handle arrays (logos, colors, typography, tags, media)
    if (Array.isArray(oldValue) || Array.isArray(newValue)) {
      const oldArr = (oldValue as unknown[]) || [];
      const newArr = (newValue as unknown[]) || [];

      // Simple diff: items in new but not in old = added, vice versa = removed
      const added = newArr.filter(
        (item) => !oldArr.some((old) => JSON.stringify(old) === JSON.stringify(item))
      );
      const removed = oldArr.filter(
        (item) => !newArr.some((newItem) => JSON.stringify(newItem) === JSON.stringify(item))
      );

      if (added.length > 0 || removed.length > 0) {
        diff[field] = {};
        if (added.length > 0) diff[field].added = added;
        if (removed.length > 0) diff[field].removed = removed;
      }
    } else {
      // Handle objects (identity, tokens, guidelines)
      diff[field] = { changed: newValue };
    }
  }

  return diff;
}

/**
 * Format version list item for API response
 */
export function formatVersionListItem(version: {
  versionNumber: number;
  changeNote: string | null;
  changedFields: string[];
  createdAt: Date;
  createdBy: string | null;
}, isCurrentVersion: boolean) {
  return {
    versionNumber: version.versionNumber,
    changeNote: version.changeNote,
    changedFields: version.changedFields,
    createdAt: version.createdAt.toISOString(),
    createdBy: version.createdBy,
    isCurrent: isCurrentVersion,
  };
}
