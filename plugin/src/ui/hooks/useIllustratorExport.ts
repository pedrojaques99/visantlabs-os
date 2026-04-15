import { useEffect } from 'react';
import { usePluginStore } from '../store';

import JSZip from 'jszip';

interface ExportItem {
  name: string;
  png?: Uint8Array;
  svg?: Uint8Array;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadItem(item: ExportItem) {
  if (item.png) {
    downloadBlob(new Blob([item.png as unknown as BlobPart], { type: 'image/png' }), `${item.name}.png`);
  }
  if (item.svg) {
    downloadBlob(new Blob([item.svg as unknown as BlobPart], { type: 'image/svg+xml' }), `${item.name}.svg`);
  }
}

async function downloadBatch(items: ExportItem[]) {
  if (items.length === 1) {
    return downloadItem(items[0]);
  }

  try {
    const zip = new JSZip();

    for (const item of items) {
      const folder = zip.folder(item.name);
      if (!folder) continue;
      if (item.png) folder.file(`${item.name}.png`, item.png);
      if (item.svg) folder.file(`${item.name}.svg`, item.svg);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'Visant_Illustrator_Batch.zip');
  } catch (err) {
    console.error('JSZip failed, falling back to individual downloads', err);
    for (const item of items) await downloadItem(item);
  }
}

export function useIllustratorExport() {
  const showToast = usePluginStore((s) => s.showToast);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg?.type) return;

      if (msg.type === 'ILLUSTRATOR_EXPORT_RESULT') {
        await downloadItem(msg);
        showToast('Arquivos exportados', 'success');
      } else if (msg.type === 'ILLUSTRATOR_EXPORT_BATCH') {
        if (msg.items && msg.items.length > 0) {
          await downloadBatch(msg.items);
          showToast(`${msg.items.length} itens exportados`, 'success');
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [showToast]);
}
