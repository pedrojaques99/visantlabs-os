import React from 'react';
import { RoomProvider } from '@/config/liveblocks';
import { useBrandCollaboration } from '@/hooks/brand/useBrandCollaboration';
import { getPresenceColor } from '@/lib/liveblocks-presence';
import { Tooltip } from '@/components/ui/Tooltip';
import { Users } from 'lucide-react';
import { LiveObject } from '@liveblocks/client';
import type { BrandGuideline } from '@/lib/figma-types';
import { LiveblocksEditorProvider, LocalEditorProvider } from '@/contexts/BrandGuidelineEditorContext';

// ─── Section presence dot ─────────────────────────────────────────────────────

interface SectionPresenceDotProps {
  /** Section id, e.g. "colors" */
  section: string;
}

export const SectionPresenceDot: React.FC<SectionPresenceDotProps> = ({ section }) => {
  const { sectionCollaborators } = useBrandCollaboration();
  const active = sectionCollaborators(section);
  if (active.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {active.slice(0, 3).map((c) => {
        const name = c.info?.name || 'Anonymous';
        const color = getPresenceColor(String(c.connectionId));
        return (
          <Tooltip key={c.connectionId} content={`${name} is here`}>
            <div
              className="w-2 h-2 rounded-full ring-1 ring-black/20 shrink-0"
              style={{ backgroundColor: color }}
            />
          </Tooltip>
        );
      })}
    </div>
  );
};

// ─── Avatar strip (top of guideline page) ─────────────────────────────────────

export const BrandCollaboratorAvatars: React.FC = () => {
  const { collaborators, collaboratorCount } = useBrandCollaboration();
  if (collaboratorCount === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Users size={12} className="text-neutral-500" />
      <div className="flex -space-x-2">
        {collaborators.slice(0, 4).map((c) => {
          const name = c.info?.name || 'Anonymous';
          const picture = c.info?.picture;
          const color = getPresenceColor(String(c.connectionId));

          return (
            <Tooltip key={c.connectionId} content={name}>
              <div
                className="w-6 h-6 rounded-full ring-2 ring-black overflow-hidden shrink-0 flex items-center justify-center text-[8px] font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {picture ? (
                  <img src={picture} alt={name} className="w-full h-full object-cover" />
                ) : (
                  name.charAt(0).toUpperCase()
                )}
              </div>
            </Tooltip>
          );
        })}
        {collaboratorCount > 4 && (
          <div className="w-6 h-6 rounded-full ring-2 ring-black bg-neutral-700 flex items-center justify-center text-[8px] font-mono text-neutral-400 shrink-0">
            +{collaboratorCount - 4}
          </div>
        )}
      </div>
      <span className="text-[10px] font-mono text-neutral-600">
        {collaboratorCount} online
      </span>
    </div>
  );
};

// ─── RoomProvider wrapper ─────────────────────────────────────────────────────

interface BrandRoomProviderProps {
  guidelineId: string;
  guideline: BrandGuideline;
  onSave: (patch: Partial<BrandGuideline>) => void;
  children: React.ReactNode;
}

/**
 * Wraps guideline editor in a Liveblocks room with collaborative storage.
 * Falls back to local draft mode when VITE_LIVEBLOCKS_PUBLIC_KEY is not set.
 */
export const BrandRoomProvider: React.FC<BrandRoomProviderProps> = ({
  guidelineId,
  guideline,
  onSave,
  children,
}) => {
  if (!import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY) {
    return (
      <LocalEditorProvider guideline={guideline} onSave={onSave}>
        {children}
      </LocalEditorProvider>
    );
  }

  return (
    <RoomProvider
      id={`brand-${guidelineId}`}
      initialPresence={{
        cursor: null,
        selectedNodeId: null,
        nodePosition: null,
        isMoving: false,
        activeSection: null,
      }}
      initialStorage={{
        nodes: [] as any,
        edges: [] as any,
        guideline: new LiveObject(guideline as unknown as Record<string, any>),
      }}
    >
      <LiveblocksEditorProvider guideline={guideline} onSave={onSave}>
        {children}
      </LiveblocksEditorProvider>
    </RoomProvider>
  );
};
