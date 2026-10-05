import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileImage, FileText, Figma } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface BrandIngestDropZoneProps {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
}

const ACCEPTED = '.fig,.pdf,.txt,.md,image/*';

// Extensão é valor técnico: fica mono. Ícone neutro; cor por tipo era enfeite.
const FILE_TYPES = [
  { icon: Figma, label: '.fig' },
  { icon: FileText, label: '.pdf' },
  { icon: FileImage, label: '.png .jpg' },
];

export function BrandIngestDropZone({ onFiles, disabled }: BrandIngestDropZoneProps) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items?.length) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      if (disabled) return;
      if (e.dataTransfer.files?.length) {
        onFiles(e.dataTransfer.files);
      }
    },
    [onFiles, disabled]
  );

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  return (
    <div className="py-6 px-2">
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'relative rounded-2xl border-2 border-dashed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isDragOver ? 'border-ring bg-muted/60' : 'border-border hover:border-ring bg-muted/30',
          disabled && 'opacity-50 pointer-events-none'
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center py-12 px-8 gap-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-muted">
            <Upload size={28} className="text-muted-foreground" />
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-foreground">
              {isDragOver ? t('brandIngest.dropToExtract') : t('brandIngest.dropTitle')}
            </p>
            <p className="text-xs text-muted-foreground">{t('brandIngest.dropHint')}</p>
          </div>

          <div className="flex items-center gap-3">
            {FILE_TYPES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border"
              >
                <Icon size={12} className="text-muted-foreground" />
                <span className="text-2xs font-mono text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED}
        multiple
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
