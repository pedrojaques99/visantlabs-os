import { useCreativeStore } from '../store/creativeStore';
import { creativeProjectApi, type CreativeProject } from '@/services/creativeProjectApi';

/**
 * Bridge between the client-side Zustand editor state and the persisted
 * CreativeProject record. Keeps the store free of HTTP concerns.
 */

export function snapshotCreativeFromStore(name?: string) {
  const s = useCreativeStore.getState();
  return {
    name: name || s.projectName || 'Untitled Creative',
    prompt: s.prompt,
    format: s.format,
    brandId: s.brandId,
    backgroundUrl: s.backgroundUrl,
    overlay: s.overlay,
    layers: s.layers,
    pages: s.pages,
    activePageIndex: s.activePageIndex,
  };
}

/** Create a new record from the current store state. */
export async function saveCurrentCreativeAsNew(name?: string, thumbnailUrl?: string | null) {
  return creativeProjectApi.create({
    ...snapshotCreativeFromStore(name),
    thumbnailUrl: thumbnailUrl ?? null,
  });
}

/** Update an existing record with the current store state. */
export async function updateCreativeFromStore(
  projectId: string,
  opts?: { name?: string; thumbnailUrl?: string | null }
) {
  return creativeProjectApi.update(projectId, {
    ...snapshotCreativeFromStore(opts?.name),
    ...(opts?.thumbnailUrl !== undefined && { thumbnailUrl: opts.thumbnailUrl }),
  });
}

/**
 * Load a persisted project back into the editor store.
 * Sets state directly (bypassing hydrateFromAI) so we preserve layer ids
 * and do not emit a spurious ai_generate event.
 */
export function loadCreativeIntoStore(project: CreativeProject) {
  // Server may persist `layers` as a JSON string (adminChatTools creates with
  // JSON.stringify([])). Normalize to array so the editor doesn't blow up.
  const layers = Array.isArray(project.layers)
    ? project.layers
    : (typeof project.layers === 'string'
        ? (JSON.parse(project.layers || '[]') as typeof project.layers)
        : []);

  const pages = project.pages || [
    {
      id: 'page_1',
      format: project.format,
      layers,
      backgroundUrl: project.backgroundUrl,
      overlay: project.overlay,
    },
  ];

  useCreativeStore.setState({
    brandId: project.brandId,
    prompt: project.prompt,
    format: project.format as any,
    creativeId: project.id,
    projectName: project.name,
    backgroundUrl: project.backgroundUrl,
    overlay: project.overlay,
    layers,
    pages: pages as any,
    activePageIndex: project.activePageIndex || 0,
    selectedLayerIds: [],
    status: 'editing',
    // Sync setup-sidebar fields so background is visible if user hits "Gerar Novo"
    uploadedBackgroundUrl: project.backgroundUrl,
    backgroundMode: project.backgroundUrl ? 'upload' : 'ai',
  });
}
