import React, { useEffect, useMemo, useState } from 'react';
import { UploadCloud, Upload, Maximize2 } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GlitchPickaxe } from '@/components/ui/GlitchPickaxe';
import { useTranslation } from '@/hooks/useTranslation';
import { getTranslations } from '@/utils/localeUtils';

interface NodePlaceholderProps {
  isLoading?: boolean;
  uploadButton?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  emptySubmessage?: string;
  elapsedTime?: number; // Time in seconds for loading counter
}

export const NodePlaceholder: React.FC<NodePlaceholderProps> = ({
  isLoading = false,
  uploadButton,
  emptyIcon = <Maximize2 size={32} className="text-neutral-600" />,
  emptyMessage = 'No output',
  emptySubmessage = 'Connect a node to see result',
  elapsedTime = 0,
}) => {
  const { locale } = useTranslation();
  const statusMessages = useMemo(() => {
    const translations = getTranslations(locale);
    return translations.mockup?.promptStatusMessages ?? [
      'understanding your design',
      'searching for the best visual solutions',
      'thinking as a senior graphic designer'
    ];
  }, [locale]);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setMessageIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % statusMessages.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isLoading, statusMessages]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-5 text-neutral-500 min-h-[75px] relative" style={{ width: '100%', minWidth: isLoading ? '200px' : '150px' }}>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 w-full">
          {/* Linha 1: Picareta */}
          <GlitchPickaxe />

          {/* Linha 2: Glitch */}
          <div className="h-4 flex items-center justify-center">
            <GlitchLoader size={14} color="brand-cyan" />
          </div>

          {/* Linha 3: Labels */}
          <div className="h-4 text-xs font-mono text-neutral-500 overflow-hidden text-center">
            <span
              key={messageIndex}
              className="block animate-fade-in"
            >
              {statusMessages[messageIndex]}
            </span>
          </div>

          {/* Linha 4: Timer (subtle) */}
          {elapsedTime > 0 && (
            <div className="h-3 flex items-center justify-center">
              <span className="text-[10px] font-mono text-neutral-500/40">
                {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
          {uploadButton || (
            <>
              {emptyIcon}
              <span className="text-xs font-mono text-neutral-500 text-center">{emptyMessage}</span>
              {emptySubmessage && (
                <span className="text-xs font-mono text-neutral-600 text-center">{emptySubmessage}</span>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
