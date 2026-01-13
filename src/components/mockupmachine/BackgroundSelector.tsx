import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface BackgroundSelectorProps {
  availableBackgrounds: string[];
  onBackgroundSelect: (background: string) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  creditsPerOperation?: number;
  openUpward?: boolean; // If true, dropdown opens upward instead of downward
}

export const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({
  availableBackgrounds,
  onBackgroundSelect,
  disabled = false,
  className = '',
  buttonClassName = '',
  creditsPerOperation,
  openUpward = false,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleBackgroundClick = (background: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(false);
    onBackgroundSelect(background);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main Button */}
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full flex items-center gap-2 px-4 py-2 bg-black/30 backdrop-blur-sm text-zinc-300 rounded-md border border-white/10 hover:border-white/20 hover:bg-white/5 hover:text-white transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${buttonClassName}`}
        title="New Background"
        aria-label="Select background environment"
        aria-expanded={isExpanded}
      >
        <MapPin size={16} />
        <span className="text-sm font-medium">New Background</span>
        {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
          <span className="text-xs font-mono text-brand-cyan ml-auto mr-1 font-semibold">
            {creditsPerOperation}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded Menu */}
      {isExpanded && (
        <div
          className={`absolute ${openUpward ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 min-w-[240px] bg-black/90 backdrop-blur-md border border-white/10 rounded-md shadow-2xl shadow-black/50 z-50 p-2 animate-fade-in`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-2">
            {availableBackgrounds.map((background) => (
              <button
                key={background}
                onClick={(e) => handleBackgroundClick(background, e)}
                className="px-3 py-2 text-xs font-medium text-zinc-300 bg-black/30 hover:bg-brand-cyan/20 hover:text-brand-cyan rounded-md border border-white/5 hover:border-[brand-cyan]/30 transition-all duration-200 text-left"
                title={`Change to ${background}`}
              >
                {background}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};










