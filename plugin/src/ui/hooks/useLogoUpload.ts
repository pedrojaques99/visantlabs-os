import { useCallback, useState } from 'react';
import { useApi } from './useApi';
import { useFigmaMessages } from './useFigmaMessages';
import { usePluginStore } from '../store';
import type { LogoSlot } from '../store/types';

type Variant = 'light' | 'dark' | 'accent';

interface UploadedLogo {
  id?: string;
  url?: string;
  thumbnailUrl?: string;
  source: 'upload' | 'figma';
  format?: string;
  figmaKey?: string;
  figmaFileKey?: string;
  figmaNodeId?: string;
  label?: string;
}

/**
 * Handles both logo sources:
 *  - uploadFile: reads a file (svg/png/jpg/pdf), sends base64 → server → R2, returns absolute URL.
 *  - linkFromSelection: asks sandbox for the currently selected Figma component +
 *    its exported PNG thumbnail, uploads thumbnail for preview, keeps component key.
 *
 * Both paths POST /api/brand-guidelines/:id/logos, which stores the logo on the
 * guideline and returns the persisted record. The slot is then patched in store.
 */
export function useLogoUpload() {
  const { call } = useApi();
  const { send } = useFigmaMessages();
  const [busySlot, setBusySlot] = useState<Variant | null>(null);

  const patchSlot = useCallback((slot: Variant, patch: Partial<LogoSlot>) => {
    const store = usePluginStore.getState();
    const next = store.logos.map((l) => (l.name === slot ? { ...l, ...patch } : l));
    usePluginStore.setState({ logos: next });
  }, []);

  const postLogo = useCallback(
    async (payload: Record<string, any>): Promise<UploadedLogo | null> => {
      const guidelineId = usePluginStore.getState().linkedGuideline;
      if (!guidelineId) {
        usePluginStore.getState().showToast('Select or create a guideline first', 'warning');
        return null;
      }
      const res: any = await call(`/api/brand-guidelines/${guidelineId}/logos`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return (res?.logo ?? null) as UploadedLogo | null;
    },
    [call]
  );

  const readFile = (file: File) =>
    new Promise<{ base64: string; format: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const base64 = String(reader.result || '');
        const fmt = (file.type.split('/')[1] || file.name.split('.').pop() || '').toLowerCase();
        resolve({ base64, format: fmt });
      };
      reader.readAsDataURL(file);
    });

  const uploadFile = useCallback(
    async (slot: Variant, file: File) => {
      setBusySlot(slot);
      try {
        const { base64, format } = await readFile(file);
        const saved = await postLogo({
          data: base64,
          variant: slot,
          label: slot,
          source: 'upload',
          format
        });
        if (saved) {
          patchSlot(slot, {
            id: saved.id,
            source: 'upload',
            url: saved.url,
            thumbnailUrl: saved.thumbnailUrl,
            src: saved.thumbnailUrl || saved.url,
            format: saved.format || format,
            loaded: true
          });
          usePluginStore.getState().showToast(`Logo uploaded (${slot})`, 'success');
        }
      } catch (err: any) {
        usePluginStore.getState().showToast(`Upload failed: ${err?.message || err}`, 'error');
      } finally {
        setBusySlot(null);
      }
    },
    [patchSlot, postLogo]
  );

  const linkFromSelection = useCallback(
    async (slot: Variant) => {
      setBusySlot(slot);
      const component = await new Promise<any>((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', handler);
          resolve(null);
        }, 12000);
        function handler(event: MessageEvent) {
          const msg = event.data?.pluginMessage;
          if (msg?.type === 'SELECTION_LOGO_RESULT') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(msg.component ?? null);
          }
        }
        window.addEventListener('message', handler);
        send({ type: 'USE_SELECTION_AS_LOGO' } as any);
      });

      if (!component) {
        usePluginStore.getState().showToast('Select a component first', 'warning');
        setBusySlot(null);
        return;
      }

      try {
        const saved = await postLogo({
          variant: slot,
          label: component.name || slot,
          source: 'figma',
          thumbnailData: component.thumbnail,
          figmaKey: component.key,
          figmaNodeId: component.id
        });
        if (saved) {
          patchSlot(slot, {
            id: saved.id,
            source: 'figma',
            thumbnailUrl: saved.thumbnailUrl,
            url: saved.url,
            src: saved.thumbnailUrl || saved.url,
            figmaKey: saved.figmaKey ?? component.key,
            figmaNodeId: saved.figmaNodeId ?? component.id,
            figmaFileKey: saved.figmaFileKey,
            label: component.name,
            loaded: true
          });
          usePluginStore.getState().showToast(`Linked @${component.name} (${slot})`, 'success');
        }
      } catch (err: any) {
        usePluginStore.getState().showToast(`Link failed: ${err?.message || err}`, 'error');
      } finally {
        setBusySlot(null);
      }
    },
    [patchSlot, postLogo, send]
  );

  const clearSlot = useCallback((slot: Variant) => {
    patchSlot(slot, {
      id: undefined, source: undefined, url: undefined, thumbnailUrl: undefined,
      src: undefined, figmaKey: undefined, figmaNodeId: undefined, figmaFileKey: undefined,
      format: undefined, label: undefined, loaded: false
    });
  }, [patchSlot]);

  return { uploadFile, linkFromSelection, clearSlot, busySlot };
}
