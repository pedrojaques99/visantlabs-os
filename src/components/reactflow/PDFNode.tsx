import React, { useRef, memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { FileText, UploadCloud } from 'lucide-react';
import type { PDFNodeData } from '@/types/reactFlow';
import { pdfToBase64 } from '@/utils/pdfUtils';
import { toast } from 'sonner';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { useTranslation } from '@/hooks/useTranslation';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { Input } from '@/components/ui/input'
import { validateFile } from '@/utils/fileUtils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PDFNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const nodeData = data as PDFNodeData;
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [PdfThumbnailComponent, setPdfThumbnailComponent] = useState<React.ComponentType<{
    pdfBase64?: string;
    pdfUrl?: string;
    fileName?: string;
    onRemove?: () => void;
    className?: string;
  }> | null>(null);

  const pdfBase64 = nodeData.pdfBase64;
  const fileName = nodeData.fileName;

  // Dynamically import PdfThumbnail to avoid SSR issues
  useEffect(() => {
    import('@/components/ui/PdfThumbnail').then((module) => {
      setPdfThumbnailComponent(() => module.PdfThumbnail);
    }).catch((error) => {
      console.error('Failed to load PdfThumbnail:', error);
    });
  }, []);

  const handlePdfUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    pdfInputRef.current?.click();
  };

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nodeData.onUploadPdf) return;

    const error = validateFile(file, 'pdf');
    if (error) {
      toast.error(error, { duration: 5000 });
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
      return;
    }

    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }

    try {
      const base64 = await pdfToBase64(file);
      nodeData.onUploadPdf(id, base64);

      // Update node with file name
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(id, { fileName: file.name });
      }

      toast.success(t('canvasNodes.pdfNode.pdfUploadedSuccessfully'), { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process PDF', { duration: 5000 });
      console.error('Failed to process PDF:', error);
    }
  };

  const handleRemovePdf = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { pdfBase64: undefined, pdfUrl: undefined, fileName: undefined });
    }
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  const handleResize = useCallback((_: any, params: { width: number }) => {
    handleResizeWithDebounce(id, params.width, 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    fitToContent(id, 'auto', 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, fitToContent]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="min-w-[240px]"
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={240}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          onResize={handleResize}
        />
      )}
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="pdf-output"
        className="w-2 h-2 bg-brand-cyan border-2 border-black node-handle"
      />

      <NodeHeader icon={FileText} title={t('canvasNodes.pdfNode.title') || 'PDF Node'} selected={selected} />

      {/* PDF Upload Section */}
      <div className="node-margin flex-1 flex flex-col gap-[var(--node-gap)]">
        {pdfBase64 || nodeData.pdfUrl ? (
          <div className="space-y-3">
            <div className="relative group/pdf">
              {PdfThumbnailComponent ? (
                <PdfThumbnailComponent
                  pdfBase64={pdfBase64}
                  pdfUrl={nodeData.pdfUrl}
                  fileName={fileName}
                  onRemove={handleRemovePdf}
                  className="w-full h-32 rounded-md border-node border-neutral-700/30 overflow-hidden"
                />
              ) : (
                <div className="w-full h-32 bg-neutral-900/50 border-node border-neutral-700/30 rounded-md flex items-center justify-center">
                  <FileText size={16} className="text-neutral-600" />
                </div>
              )}
            </div>
            {fileName && (
              <div className="text-[10px] font-mono truncate text-brand-cyan px-1 uppercase ">
                {fileName}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              onChange={handlePdfFileChange}
              className="hidden"
            />
            <NodeButton
              variant="primary"
              size="full"
              onClick={handlePdfUploadClick}
              className="nodrag shadow-sm backdrop-blur-sm"
            >
              <UploadCloud size={14} className="mr-2" />
              {t('canvasNodes.pdfNode.uploadPdf') || 'Upload PDF'}
            </NodeButton>
          </div>
        )}
      </div>
    </NodeContainer>
  );
});

PDFNode.displayName = 'PDFNode';
