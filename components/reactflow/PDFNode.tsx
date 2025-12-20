import React, { useRef, memo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText, UploadCloud } from 'lucide-react';
import type { PDFNodeData } from '../../types/reactFlow';
import { pdfToBase64, validatePdfFile } from '../../utils/pdfUtils';
import { toast } from 'sonner';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { useTranslation } from '../../hooks/useTranslation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PDFNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
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
    import('../ui/PdfThumbnail').then((module) => {
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

    // Check if it's a PDF
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error(t('canvasNodes.pdfNode.pleaseSelectPdfFile'), { duration: 3000 });
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
      return;
    }

    const validation = validatePdfFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || 'Invalid PDF file', { duration: 5000 });
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

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[240px] max-w-[300px]"
    >
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="pdf-output"
        className="w-2 h-2 bg-[#52ddeb] border-2 border-black node-handle"
      />

      {/* Header */}
      <NodeHeader icon={FileText} title={t('canvasNodes.pdfNode.title')} />

      {/* PDF Upload Section */}
      {pdfBase64 || nodeData.pdfUrl ? (
        <div className="mt-3 space-y-3">
          <div className="relative group/pdf">
            {PdfThumbnailComponent ? (
              <PdfThumbnailComponent
                pdfBase64={pdfBase64}
                pdfUrl={nodeData.pdfUrl}
                fileName={fileName}
                onRemove={handleRemovePdf}
                className="w-full h-32"
              />
            ) : (
              <div className="w-full h-32 bg-zinc-900/50 border border-zinc-700/30 rounded flex items-center justify-center">
                <FileText size={16} className="text-zinc-600" />
              </div>
            )}
          </div>
          {fileName && (
            <div className="text-xs font-mono truncate text-[#52ddeb] px-1">
              {fileName}
            </div>
          )}
        </div>
      ) : (
        <>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            onChange={handlePdfFileChange}
            className="hidden"
          />
          <NodeButton onClick={handlePdfUploadClick}>
            <UploadCloud size={14} />
            Upload PDF
          </NodeButton>
        </>
      )}
    </NodeContainer>
  );
});

PDFNode.displayName = 'PDFNode';
