import React, { useEffect, useMemo, useState } from 'react';
import { GlitchLoader } from './GlitchLoader';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../hooks/useTheme';
import { getTranslations } from '../../utils/localeUtils';

interface GeneratingPromptOverlayProps {
  isVisible: boolean;
}

export const GeneratingPromptOverlay: React.FC<GeneratingPromptOverlayProps> = ({ isVisible }) => {
  const { locale } = useTranslation();
  const { theme } = useTheme();
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
    if (!isVisible) {
      setMessageIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % statusMessages.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isVisible, statusMessages]);

  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in ${theme === 'dark' ? 'bg-black/80' : 'bg-white/80'
      }`}>
      <div className={`border border-[brand-cyan]/20 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 backdrop-blur-md animate-fade-in ${theme === 'dark' ? 'bg-zinc-900/95' : 'bg-white/95'
        }`}>
        <div className="flex flex-col items-center justify-center gap-4">
          <GlitchLoader size={24} />
          <span className="text-lg font-mono font-semibold text-brand-cyan uppercase tracking-wider">
            GENERATING PROMPT...
          </span>
          <div className="h-5 text-sm font-mono uppercase tracking-wide text-foreground overflow-hidden">
            <span
              key={messageIndex}
              className="block animate-fade-in text-center"
            >
              {statusMessages[messageIndex]}
            </span>
          </div>
          <div className="w-full max-w-xs mt-2">
            <div className={`h-0.5 rounded-md overflow-hidden relative ${theme === 'dark' ? 'bg-zinc-800/30' : 'bg-zinc-300/50'
              }`}>
              <div
                className="h-full bg-brand-cyan rounded-md absolute"
                style={{
                  width: '30%',
                  animation: 'scroll-horizontal 1.5s linear infinite'
                }}
              />
            </div>
            <style>{`
              @keyframes scroll-horizontal {
                0% {
                  left: -30%;
                }
                100% {
                  left: 100%;
                }
              }
            `}</style>
          </div>
        </div>
      </div>
    </div>
  );
};

