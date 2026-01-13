import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Mockup } from '../services/mockupApi';
import { getImageUrl } from '@/utils/imageUtils';

interface MockupDetailModalProps {
  mockup: Mockup;
  allMockups?: Mockup[];
  currentIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (mockup: Mockup) => void;
  onImportToCanvas?: (mockup: Mockup) => void;
  onNavigate?: (mockup: Mockup) => void;
  isAuthenticated?: boolean;
  onAuthRequired?: () => void;
}

export const MockupDetailModal: React.FC<MockupDetailModalProps> = ({
  mockup,
  allMockups = [],
  currentIndex = 0,
  isOpen,
  onClose,
  onEdit,
  onImportToCanvas,
  onNavigate,
  isAuthenticated = false,
  onAuthRequired,
}) => {
  const imageUrl = getImageUrl(mockup);

  const hasPrevious = allMockups.length > 0 && currentIndex > 0;
  const hasNext = allMockups.length > 0 && currentIndex < allMockups.length - 1;

  const handlePrevious = React.useCallback(() => {
    if (hasPrevious && onNavigate && allMockups.length > 0) {
      onNavigate(allMockups[currentIndex - 1]);
    }
  }, [hasPrevious, onNavigate, allMockups, currentIndex]);

  const handleNext = React.useCallback(() => {
    if (hasNext && onNavigate && allMockups.length > 0) {
      onNavigate(allMockups[currentIndex + 1]);
    }
  }, [hasNext, onNavigate, allMockups, currentIndex]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && hasPrevious) {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault();
        handleNext();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose, hasPrevious, hasNext, handlePrevious, handleNext]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-6xl w-full max-h-[95vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navigation Arrows */}
        {hasPrevious && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrevious();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 opacity-40 hover:opacity-100 transition-opacity text-white"
            title="Previous (←)"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 opacity-40 hover:opacity-100 transition-opacity text-white"
            title="Next (→)"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Preview Image */}
        <img
          src={imageUrl}
          alt={mockup.prompt || 'Mockup'}
          className="max-w-full max-h-[95vh] w-auto h-auto object-contain"
        />
      </div>
    </div>
  );
};

