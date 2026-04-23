/**
 * Brand Guidelines — Liveblocks auth access control.
 *
 * Tests the permission logic that decides FULL_ACCESS vs READ_ACCESS vs 403.
 * We test the logic in isolation (no HTTP, no Liveblocks SDK calls).
 */
import { describe, it, expect } from 'vitest';

// ─── Permission logic mirrored from the route ─────────────────────────────────

function resolveAccess(
  guidelineUserId: string,
  canEdit: string[],
  canView: string[],
  requestingUserId: string,
): 'FULL_ACCESS' | 'READ_ACCESS' | 'DENIED' {
  const isOwner = guidelineUserId === requestingUserId;
  const hasEdit = isOwner || canEdit.includes(requestingUserId);
  const hasView = isOwner || hasEdit || canView.includes(requestingUserId);
  if (!hasView) return 'DENIED';
  return hasEdit ? 'FULL_ACCESS' : 'READ_ACCESS';
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Liveblocks access control — resolveAccess', () => {
  const OWNER = 'user-owner';
  const EDITOR = 'user-editor';
  const VIEWER = 'user-viewer';
  const STRANGER = 'user-stranger';

  it('owner gets FULL_ACCESS', () => {
    expect(resolveAccess(OWNER, [], [], OWNER)).toBe('FULL_ACCESS');
  });

  it('user in canEdit gets FULL_ACCESS', () => {
    expect(resolveAccess(OWNER, [EDITOR], [], EDITOR)).toBe('FULL_ACCESS');
  });

  it('user in canView gets READ_ACCESS', () => {
    expect(resolveAccess(OWNER, [], [VIEWER], VIEWER)).toBe('READ_ACCESS');
  });

  it('user in both canEdit and canView gets FULL_ACCESS (edit wins)', () => {
    expect(resolveAccess(OWNER, [EDITOR], [EDITOR], EDITOR)).toBe('FULL_ACCESS');
  });

  it('unknown user gets DENIED', () => {
    expect(resolveAccess(OWNER, [EDITOR], [VIEWER], STRANGER)).toBe('DENIED');
  });

  it('empty canEdit and canView — only owner has access', () => {
    expect(resolveAccess(OWNER, [], [], EDITOR)).toBe('DENIED');
    expect(resolveAccess(OWNER, [], [], OWNER)).toBe('FULL_ACCESS');
  });

  it('owner is not affected by canEdit or canView lists', () => {
    expect(resolveAccess(OWNER, [EDITOR], [VIEWER], OWNER)).toBe('FULL_ACCESS');
  });
});

// ─── sectionCollaborators filter (from useBrandCollaboration hook) ────────────

interface Collaborator {
  connectionId: number;
  presence: { activeSection: string | null } | null;
}

function sectionCollaborators(section: string, collaborators: Collaborator[]) {
  return collaborators.filter(c => c.presence?.activeSection === section);
}

describe('sectionCollaborators', () => {
  const collaborators: Collaborator[] = [
    { connectionId: 1, presence: { activeSection: 'colors' } },
    { connectionId: 2, presence: { activeSection: 'typography' } },
    { connectionId: 3, presence: { activeSection: 'colors' } },
    { connectionId: 4, presence: null },
  ];

  it('returns only users in the given section', () => {
    expect(sectionCollaborators('colors', collaborators)).toHaveLength(2);
  });

  it('returns empty when no users in section', () => {
    expect(sectionCollaborators('strategy', collaborators)).toHaveLength(0);
  });

  it('excludes users with null presence', () => {
    const result = sectionCollaborators('colors', collaborators);
    expect(result.every(c => c.presence !== null)).toBe(true);
  });

  it('returns correct connectionIds', () => {
    const ids = sectionCollaborators('colors', collaborators).map(c => c.connectionId);
    expect(ids).toEqual([1, 3]);
  });
});
