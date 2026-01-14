import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getTranslations } from '@/utils/localeUtils';

interface SkeletonLoaderProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  variant = 'rectangular',
}) => {
  const baseClasses = 'animate-pulse bg-neutral-800/50 rounded';

  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-md',
    rectangular: '',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      aria-label="Loading..."
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export const SkeletonCard: React.FC<{ aspectRatio?: string }> = ({ aspectRatio = '16:9' }) => {
  const { locale } = useTranslation();
  const skeletonMessages = useMemo(() => {
    const translations = getTranslations(locale);
    return translations.mockup?.skeletonStatusMessages ?? [
      'rendering concepts...',
      'designing compositions...',
      'searching visual balance...',
      'polishing details...',
      'almost there...'
    ];
  }, [locale]);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % skeletonMessages.length);
    }, 2500);

    return () => clearInterval(intervalId);
  }, [skeletonMessages]);

  const aspectClasses: Record<string, string> = {
    '16:9': 'aspect-[16/9]',
    '4:3': 'aspect-[4/3]',
    '1:1': 'aspect-square',
  };

  return (
    <div className={`${aspectClasses[aspectRatio] || 'aspect-[16/9]'} bg-neutral-800/30 rounded-md overflow-hidden border border-neutral-800/50 relative`}>
      <SkeletonLoader width="100%" height="100%" variant="rectangular" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          key={messageIndex}
          className="text-xs font-mono uppercase tracking-wide text-white/70 bg-black/30 px-3 py-1 rounded-md backdrop-blur animate-fade-in"
        >
          {skeletonMessages[messageIndex]}
        </span>
      </div>
    </div>
  );
};

