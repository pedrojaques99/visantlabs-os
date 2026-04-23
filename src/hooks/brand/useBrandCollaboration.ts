import { useCallback } from 'react';
import { useOthers, useUpdateMyPresence, useSelf } from '@/config/liveblocks';

export interface BrandPresence {
  /** Which section the user is currently viewing/editing, e.g. "colors", "typography" */
  activeSection: string | null;
  /** Display name shown in presence indicators */
  displayName?: string;
  /** Avatar URL */
  avatar?: string;
}

/**
 * Presence hook for collaborative brand guideline editing.
 *
 * Usage: wrap the guideline editor in a <RoomProvider id={`brand-${guidelineId}`} ...>
 * and call this hook inside to get presence state.
 */
export function useBrandCollaboration() {
  const others = useOthers();
  const self = useSelf();
  const updateMyPresence = useUpdateMyPresence();

  const setActiveSection = useCallback(
    (section: string | null) => {
      updateMyPresence({ activeSection: section } as any);
    },
    [updateMyPresence],
  );

  /** Users currently viewing/editing this guideline (excludes self) */
  const collaborators = others.map((other) => ({
    connectionId: other.connectionId,
    presence: (other.presence as unknown) as BrandPresence | null,
    info: other.info as { name?: string; email?: string; picture?: string } | undefined,
  }));

  /** Users editing the same section as you */
  const sectionCollaborators = (section: string) =>
    collaborators.filter((c) => c.presence?.activeSection === section);

  const collaboratorCount = collaborators.length;

  return {
    collaborators,
    collaboratorCount,
    sectionCollaborators,
    setActiveSection,
    selfInfo: self?.info as { name?: string; email?: string; picture?: string } | undefined,
  };
}
