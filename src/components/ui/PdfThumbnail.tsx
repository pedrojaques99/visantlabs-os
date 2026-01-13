import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PdfThumbnailProps {
  pdfBase64?: string;
  pdfUrl?: string;
  fileName?: string;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export const PdfThumbnail: React.FC<PdfThumbnailProps> = ({
  pdfBase64,
  pdfUrl,
  fileName,
  onRemove,
  onClick,
  className,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Determine PDF source
  const pdfSource = React.useMemo(() => {
    if (pdfUrl) {
      return pdfUrl;
    }
    if (pdfBase64) {
      // Add data URL prefix if not present
      if (pdfBase64.startsWith('data:')) {
        return pdfBase64;
      }
      return `data:application/pdf;base64,${pdfBase64}`;
    }
    return null;
  }, [pdfBase64, pdfUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setHasError(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setHasError(true);
    setIsLoading(false);
  };

  if (!pdfSource) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative group aspect-square bg-zinc-900/50 border border-zinc-700/30 rounded overflow-hidden',
        onClick && 'cursor-pointer hover:border-[brand-cyan]/50 transition-colors',
        className
      )}
      onClick={onClick}
    >
      {hasError ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 gap-1">
          <FileText size={16} className="text-zinc-600" />
          {fileName && (
            <span className="text-[10px] font-mono text-zinc-600 truncate max-w-full px-1">
              {fileName}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full h-full relative flex items-center justify-center bg-zinc-900/50">
          <Document
            file={pdfSource}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[brand-cyan] border-t-transparent rounded-md animate-spin" />
              </div>
            }
            className="w-full h-full flex items-center justify-center"
          >
            {numPages && numPages > 0 && (
              <Page
                pageNumber={1}
                width={160}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="[&>canvas]:max-w-full [&>canvas]:max-h-full [&>canvas]:object-contain"
              />
            )}
          </Document>
        </div>
      )}

      {/* Remove button (if provided) */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 border border-black rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Remove PDF"
        >
          <X size={10} className="text-white" strokeWidth={3} />
        </button>
      )}

      {/* File name tooltip on hover */}
      {fileName && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[10px] font-mono px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {fileName}
        </div>
      )}
    </div>
  );
};
