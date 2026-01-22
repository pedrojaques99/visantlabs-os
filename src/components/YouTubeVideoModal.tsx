import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { isSafeUrl } from '@/utils/imageUtils';

interface YouTubeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
}

export const YouTubeVideoModal: React.FC<YouTubeVideoModalProps> = ({
  isOpen,
  onClose,
  videoId,
}) => {
  const { theme } = useTheme();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-neutral-950/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-4xl mx-4 ${theme === 'dark' ? 'bg-neutral-900' : 'bg-white'
          } border border-neutral-800/50 rounded-md shadow-xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800/50">
          <h2 className={`text-lg font-semibold font-mono ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
            } uppercase`}>
            Tutorial Video
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={isSafeUrl(`https://www.youtube.com/embed/${videoId}`) ? `https://www.youtube.com/embed/${videoId}` : ''}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};




