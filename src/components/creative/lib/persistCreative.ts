import { useCreativeStore } from '../store/creativeStore';
import { creativeProjectApi, type CreativeProject } from '@/services/creativeProjectApi';
import { canvasApi } from '@/services/canvasApi';

/**
 * Bridge between the client-side Zustand editor state and the persisted
 * CreativeProject record. Keeps the store free of HTTP concerns.
 */

/** Blob URLs die with the browser session — upload to R2 so the URL survives reloads. */
async function ensurePersistedUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || !url.startsWith('blob:')) return url ?? null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return await canvasApi.uploadImageToR2(base64);
  } catch (e) {
    console.warn('[persistCreative] failed to upload blob to R2:', e);
    return null;
  }
}

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
export async function saveCurrentCreativeAsNew(
  name?: string,
  thumbnailUrl?: string | null,
  opts?: { signal?: AbortSignal }
) {
  const snapshot = snapshotCreativeFromStore(name);
  const backgroundUrl = await ensurePersistedUrl(snapshot.backgroundUrl);
  if (backgroundUrl && backgroundUrl !== snapshot.backgroundUrl) {
    useCreativeStore.setState({ backgroundUrl, uploadedBackgroundUrl: backgroundUrl });
    snapshot.backgroundUrl = backgroundUrl;
  }
  return creativeProjectApi.create(
    {
      ...snapshot,
      thumbnailUrl: thumbnailUrl ?? null,
    },
    { signal: opts?.signal }
  );
}

/** Update an existing record with the current store state. */
export async function updateCreativeFromStore(
  projectId: string,
  opts?: { name?: string; thumbnailUrl?: string | null }
) {
  const snapshot = snapshotCreativeFromStore(opts?.name);
  return ensurePersistedUrl(snapshot.backgroundUrl).then((backgroundUrl) => {
    if (backgroundUrl && backgroundUrl !== snapshot.backgroundUrl) {
      useCreativeStore.setState({ backgroundUrl, uploadedBackgroundUrl: backgroundUrl });
      snapshot.backgroundUrl = backgroundUrl;
    }
    return creativeProjectApi.update(projectId, {
      ...snapshot,
      ...(opts?.thumbnailUrl !== undefined && { thumbnailUrl: opts.thumbnailUrl }),
    });
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

  // Mirror the active page into root state so KonvaCanvas (which reads root)
  // shows the right page on load. Without this, projects whose persisted root
  // drifted from pages would render the stale snapshot.
  const activeIdx = Math.min(project.activePageIndex || 0, pages.length - 1);
  const activePage = pages[activeIdx];

  useCreativeStore.setState({
    brandId: project.brandId,
    prompt: project.prompt,
    format: project.format as any,
    creativeId: project.id,
    projectName: project.name,
    backgroundUrl: activePage?.backgroundUrl ?? project.backgroundUrl,
    overlay: activePage?.overlay ?? project.overlay,
    layers: activePage?.layers ?? layers,
    pages: pages as any,
    activePageIndex: activeIdx,
    selectedLayerIds: [],
    status: 'editing',
    // Sync setup-sidebar fields so background is visible if user hits "Gerar Novo"
    uploadedBackgroundUrl: project.backgroundUrl,
    backgroundMode: project.backgroundUrl ? 'upload' : 'ai',
  });
}
