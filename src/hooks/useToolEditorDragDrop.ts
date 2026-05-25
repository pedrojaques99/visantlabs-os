import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { usePasteImage } from '@/hooks/usePasteImage';

export type FileAccept = 'image' | 'video' | 'svg' | 'image+video';

export interface UseToolEditorDragDropOptions {
  accept: FileAccept;
  onFile: (file: File) => void;
  dropMessage?: string;
}

function fileMatchesAccept(file: File, accept: FileAccept): boolean {
  switch (accept) {
    case 'image': return file.type.startsWith('image/');
    case 'video': return file.type.startsWith('video/');
    case 'svg': return file.type === 'image/svg+xml' || file.name.endsWith('.svg');
    case 'image+video': return file.type.startsWith('image/') || file.type.startsWith('video/');
  }
}

export function useToolEditorDragDrop({ accept, onFile, dropMessage }: UseToolEditorDragDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !fileMatchesAccept(file, accept)) return;
    onFile(file);
  }, [accept, onFile]);

  usePasteImage(useCallback(({ file }) => {
    if (!file || !fileMatchesAccept(file, accept)) return;
    onFile(file);
  }, [accept, onFile]));

  const dragProps = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  return {
    isDragOver,
    dragProps,
    dropMessage: dropMessage || `Drop ${accept === 'image+video' ? 'image or video' : accept} here`,
  };
}
