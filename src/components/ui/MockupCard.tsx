import React from 'react';
import { Edit, Trash2, Maximize2 } from 'lucide-react';
import type { Mockup } from '@/services/mockupApi';
import { getImageUrl } from '@/utils/imageUtils';

interface MockupCardProps {
  mockup: Mockup;
  onEdit?: (mockup: Mockup) => void;
  onDelete?: (mockupId: string) => void;
  onView?: (mockup: Mockup) => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
  className?: string;
  viewportScale?: number; // Scale of the viewport to compensate button size
}

export const MockupCard: React.FC<MockupCardProps> = ({
  mockup,
  onEdit,
  onDelete,
  onView,
  isDragging = false,
  style,
  className = '',
  viewportScale = 1,
}) => {
  const imageUrl = getImageUrl(mockup);
  const mockupId = mockup._id || '';

  if (!imageUrl) return null;

  // Calculate inverse scale to keep buttons at fixed size
  // Only compensate when zoomed in (>100%), otherwise buttons would be larger than image
  const buttonScale = viewportScale > 1 ? 1 / viewportScale : 1;

  return (
    <div
      className={`relative mockup-entry group overflow-visible ${className}`}
      style={style}
    >
      <div className="mockup-image-wrapper relative overflow-visible">
        <img
          src={imageUrl}
          alt="Mockup"
          draggable={false}
          className="w-full h-auto object-contain rounded-md shadow-lg select-none pointer-events-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target) {
              target.style.display = 'none';
            }
          }}
        />

        {/* Hover Actions Overlay - Buttons compensate for zoom scale */}
        {(onEdit || onDelete || onView) && (
          <div
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-md flex items-center justify-center gap-2 pointer-events-none overflow-visible origin-center will-change-[transform,opacity]"
            style={{
              transform: `scale(${buttonScale})`,
            }}
          >
            {onView && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onView(mockup);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-2.5 bg-brand-cyan/70 hover:bg-brand-cyan/90 text-black rounded-md transition-all backdrop-blur-sm shadow-lg hover:shadow-xl pointer-events-auto"
                title="View Full Screen"
              >
                <Maximize2 size={18} />
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onEdit(mockup);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-2.5 bg-brand-cyan/70 hover:bg-brand-cyan/90 text-black rounded-md transition-all backdrop-blur-sm shadow-lg hover:shadow-xl pointer-events-auto"
                title="Edit"
              >
                <Edit size={18} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (confirm('Are you sure you want to delete this mockup?')) {
                    onDelete(mockupId);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-2.5 bg-red-500/70 hover:bg-red-500/90 text-white rounded-md transition-all backdrop-blur-sm shadow-lg hover:shadow-xl pointer-events-auto"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

