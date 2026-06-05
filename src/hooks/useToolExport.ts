import { useCallback } from 'react';
import { downloadImage, downloadBlob as dlBlob } from '@/utils/clipboard';
import { pipelineApi, type AssetSource } from '@/services/pipelineApi';
import { toast } from 'sonner';
import JSZip from 'jszip';

export interface ExportItem {
  data: string | Blob;
  filename: string;
}

interface UseToolExportReturn {
  downloadSingle: (data: string | Blob, filename: string) => void;
  downloadBatch: (items: ExportItem[], zipName: string) => Promise<void>;
  sendTo: (targetPath: string, data: string | Blob, mime: string, label?: string) => Promise<void>;
  copyToClipboard: (data: string | Blob) => Promise<boolean>;
}

function base64ToBlob(base64: string): Blob {
  const [header, body] = base64.split(',');
  const mime = header?.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(body);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function getExtFromFilename(filename: string): string {
  return filename.split('.').pop() ?? 'png';
}

export function useToolExport(toolId: string): UseToolExportReturn {
  const downloadSingle = useCallback((data: string | Blob, filename: string) => {
    if (typeof data === 'string' && data.startsWith('data:')) {
      downloadImage(data, filename);
    } else if (data instanceof Blob) {
      dlBlob(data, filename);
    } else {
      const blob = new Blob([data], { type: 'application/octet-stream' });
      dlBlob(blob, filename);
    }
  }, []);

  const downloadBatch = useCallback(async (items: ExportItem[], zipName: string) => {
    if (items.length === 0) return;
    if (items.length === 1) {
      downloadSingle(items[0].data, items[0].filename);
      return;
    }

    const zip = new JSZip();
    for (const item of items) {
      if (typeof item.data === 'string' && item.data.startsWith('data:')) {
        const body = item.data.split(',')[1];
        zip.file(item.filename, body, { base64: true });
      } else if (item.data instanceof Blob) {
        zip.file(item.filename, item.data);
      } else {
        zip.file(item.filename, item.data);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    dlBlob(blob, zipName);
  }, [downloadSingle]);

  const sendTo = useCallback(
    async (_targetPath: string, data: string | Blob, mime: string, label?: string) => {
      try {
        const payload: { source: AssetSource; mimeType: string; label?: string; imageBase64?: string; imageUrl?: string } = {
          source: toolId as AssetSource,
          mimeType: mime,
          label,
        };

        if (typeof data === 'string' && data.startsWith('data:')) {
          payload.imageBase64 = data;
        } else if (typeof data === 'string') {
          payload.imageUrl = data;
        } else {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(data);
          });
          payload.imageBase64 = base64;
        }

        await pipelineApi.send(payload);
        toast.success('Sent to pipeline — open the destination tool to use it');
      } catch {
        toast.error('Failed to send asset');
      }
    },
    [toolId],
  );

  const copyToClipboard = useCallback(async (data: string | Blob): Promise<boolean> => {
    try {
      const blob = data instanceof Blob ? data : base64ToBlob(data as string);
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast.success('Copied to clipboard');
      return true;
    } catch {
      toast.error('Failed to copy');
      return false;
    }
  }, []);

  return { downloadSingle, downloadBatch, sendTo, copyToClipboard };
}
