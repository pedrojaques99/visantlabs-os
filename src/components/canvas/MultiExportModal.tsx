import React, { useState, useEffect, useMemo } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import {
  X,
  Download,
  Check,
  Square,
  CheckSquare,
  Search,
  Filter,
  Image as ImageIcon,
} from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { exportImageWithScale } from '@/utils/exportUtils';
import { toast } from 'sonner';
import type { FlowNode } from '@/types/reactFlow';
import { getImageUrl } from '@/utils/imageUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Thumb } from '@/components/ui/Thumb';
import { useTranslation } from '@/hooks/useTranslation';

interface MultiExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: FlowNode[];
  projectName?: string;
}

interface ExportableImage {
  id: string;
  url: string;
  name: string;
  type: string;
}

const FORMAT_OPTIONS = ['PNG', 'JPG'] as const;
type ExportFormat = (typeof FORMAT_OPTIONS)[number];

export const MultiExportModal: React.FC<MultiExportModalProps> = ({
  isOpen,
  onClose,
  nodes,
  projectName,
}) => {
  useScrollLock(isOpen);
  const { t } = useTranslation();
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<ExportFormat>('PNG');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Extract all exportable images from nodes (Strict filtering for outputs)
  const exportableImages = useMemo(() => {
    const images: ExportableImage[] = [];

    nodes.forEach((node) => {
      let url: string | null = null;
      let name = node.data.label || `${node.type}-${node.id.substring(0, 4)}`;

      // Strict Filter: Only select nodes with explicit result data (Output nodes and processing nodes)
      // This excludes standard ImageNode (inputs), LogoNode, etc.
      const data = node.data as any;
      if (data.resultImageUrl || data.resultImageBase64) {
        url =
          data.resultImageUrl ||
          (data.resultImageBase64
            ? data.resultImageBase64.startsWith('data:')
              ? data.resultImageBase64
              : `data:image/png;base64,${data.resultImageBase64}`
            : null);
      }
      // Explicitly handle 'output' type if it relies on other fields, but OutputNodeData uses resultImageUrl too.
      // If there's any edge case where OutputNode doesn't have result* but should be exported (e.g. connected image), we might need to handle it, but usually it has result data.

      // Name fallback for OutputNode
      if (node.type === 'output' && data.label) {
        name = data.label;
      }

      if (url) {
        images.push({
          id: node.id,
          url,
          name,
          type: node.type as string,
        });
      }
    });

    return images;
  }, [nodes]);

  // Filter images based on search query
  const filteredImages = useMemo(() => {
    if (!searchQuery) return exportableImages;
    const query = searchQuery.toLowerCase();
    return exportableImages.filter(
      (img) => img.name.toLowerCase().includes(query) || img.type.toLowerCase().includes(query)
    );
  }, [exportableImages, searchQuery]);

  // Handle image selection
  const toggleImage = (id: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedImages(newSelected);
  };

  const selectAll = () => {
    if (selectedImages.size === filteredImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredImages.map((img) => img.id)));
    }
  };

  const handleExport = async () => {
    if (selectedImages.size === 0 || isExporting) return;

    setIsExporting(true);
    const selectedList = exportableImages.filter((img) => selectedImages.has(img.id));

    try {
      // Try using File System Access API for folder selection
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await window.showDirectoryPicker();
          const usedNames = new Set<string>();

          for (const img of selectedList) {
            try {
              // For now we trust the URL is accessible (CORS might be tricky if external, but usually these are internal/R2)
              // Use helper or fetch directly
              const response = await fetch(img.url);
              const blob = await response.blob();

              // Handle filename uniqueness
              const safeName = img.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
              let baseFilename = safeName || 'image';
              const extension = exportFormat.toLowerCase();
              let filename = `${baseFilename}.${extension}`;

              let counter = 1;
              while (usedNames.has(filename)) {
                filename = `${baseFilename}_${counter}.${extension}`;
                counter++;
              }
              usedNames.add(filename);

              const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
            } catch (err) {
              console.error(`Failed to save ${img.name}:`, err);
              toast.error(t('canvasExport.saveFailed', { name: img.name }));
            }
          }
          toast.success(t('canvasExport.exported', { count: selectedImages.size }));
          onClose();
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('Directory selection failed:', err);
            toast.error(t('canvasExport.folderFailed'));
          } else {
            // User cancelled
            setIsExporting(false);
            return;
          }
        }
      }

      // Fallback to individual downloads
      const promises = selectedList.map((img, index) => {
        // Add a small delay between downloads to prevent browser blocking
        return new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await exportImageWithScale(
                img.url,
                exportFormat.toLowerCase() as 'png' | 'jpg',
                1.5,
                img.name || `image-${index + 1}`
              );
            } catch (err) {
              console.error(`Failed to export ${img.name}:`, err);
            }
            resolve();
          }, index * 200);
        });
      });

      await Promise.all(promises);
      toast.success(t('canvasExport.exported', { count: selectedImages.size }));
      onClose();
    } catch (error) {
      console.error('Multi-export error:', error);
      toast.error(t('canvasExport.someFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm p-4">
      <div className="bg-popover border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Download size={20} className="text-muted-foreground" />
              {t('canvasExport.title')}
            </h2>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 text-muted-foreground hover:text-muted-foreground hover:bg-accent rounded-md transition-colors"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 bg-muted flex flex-wrap items-center justify-between gap-4 border-b border-border">
          <div className="flex items-center gap-4 flex-1 min-w-[300px]">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                type="text"
                placeholder={t('canvasExport.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-md text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              />
            </div>

            <Button
              variant="ghost"
              onClick={selectAll}
              className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors whitespace-nowrap"
            >
              {selectedImages.size === filteredImages.length && filteredImages.length > 0 ? (
                <CheckSquare size={14} className="text-muted-foreground" />
              ) : (
                <Square size={14} />
              )}
              {selectedImages.size === filteredImages.length && filteredImages.length > 0
                ? t('canvasExport.deselectAll')
                : t('canvasExport.selectAll')}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-muted border border-border p-1 rounded-md">
              {FORMAT_OPTIONS.map((format) => (
                <Button
                  variant="ghost"
                  key={format}
                  onClick={() => setExportFormat(format)}
                  className={cn(
                    'px-3 py-1 text-2xs rounded transition-colors',
                    exportFormat === format
                      ? 'bg-accent text-foreground border border-border'
                      : 'text-muted-foreground hover:text-muted-foreground'
                  )}
                >
                  {format}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid Gallery */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent">
          {filteredImages.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => toggleImage(img.id)}
                  className={cn(
                    'group relative aspect-square rounded-xl border transition-colors cursor-pointer overflow-hidden',
                    selectedImages.has(img.id)
                      ? 'border-ring ring-1 ring-ring/20'
                      : 'border-border hover:border-border-hover bg-muted'
                  )}
                >
                  <Thumb src={img.url} alt={img.name} className="w-full h-full object-cover" />

                  {/* Overlay */}
                  <div
                    className={cn(
                      'absolute inset-0 transition-opacity flex flex-col justify-between p-2',
                      selectedImages.has(img.id)
                        ? 'bg-black/10' // EXCEÇÃO ao lightmode/dark-surface-no-token: scrim sobre a miniatura da imagem
                        : 'bg-black/0 group-hover:bg-black/70 opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <div className="flex justify-end">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center border transition-colors',
                          selectedImages.has(img.id)
                            ? 'bg-foreground border-transparent text-background'
                            : 'bg-background/70 border-border-hover text-transparent'
                        )}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                    </div>

                    <div className="bg-background/80 rounded-md p-2">
                      <p className="text-2xs text-foreground font-mono truncate" title={img.name}>
                        {img.name}
                      </p>
                      <p className="text-2xs text-muted-foreground mt-0.5">{img.type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 py-12">
              <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center">
                <ImageIcon size={32} opacity={0.2} />
              </div>
              <p className="text-sm">
                {searchQuery ? t('canvasExport.noMatch') : t('canvasExport.noImages')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {t('canvasExport.selectedCount', {
              count: selectedImages.size,
              total: exportableImages.length,
            })}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExport}
              disabled={selectedImages.size === 0 || isExporting}
              className="gap-2 px-6 text-xs"
            >
              {isExporting ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {t('common.exporting')}
                </>
              ) : (
                <>
                  <Download size={14} />
                  {t('canvasExport.exportSelected')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
