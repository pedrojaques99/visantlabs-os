import React from 'react';
import type { BudgetData } from '../../../types';
import { InlineEditor } from '../InlineEditor';
import { BackPageBackground } from './BackPageBackground';

interface VisantBackCoverPageProps {
  data: BudgetData;
  editable?: boolean;
  onDataChange?: (data: Partial<BudgetData>) => void;
}

export const VisantBackCoverPage: React.FC<VisantBackCoverPageProps> = ({
  data,
  editable = false,
  onDataChange,
}) => {
  const accentColor = data.brandAccentColor || data.brandColors[0] || '#brand-cyan';
  const bgColor = '#151515';
  const textColor = '#f3f3f3';
  const year = data.year || '2025';
  const finalCTAText = data.finalCTAText || 'VAMOS CONSTRUIR ALGO GRANDE JUNTOS?';

  // Arrow decorative element
  const Arrow = ({ rotation = 0, opacity = 0.3, style: customStyle = {} }: { rotation?: number; opacity?: number; style?: React.CSSProperties }) => (
    <svg
      width="310"
      height="310"
      viewBox="0 0 310 310"
      style={{
        position: 'absolute',
        transform: `rotate(${rotation}deg)`,
        opacity,
        ...customStyle,
      }}
    >
      <path
        d="M0 155L310 155M155 0L310 155L155 310"
        stroke={accentColor}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <div
      className="w-full h-full flex flex-col justify-between relative overflow-hidden"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        minHeight: '1131px', // A4 height for 800px width (800 * 1.414)
        padding: '60px',
      }}
    >
      {/* Background SVG */}
      <BackPageBackground accentColor={accentColor} opacity={1} />



      {/* Top section - Logo and title */}
      <div
        className="flex items-start justify-between flex-shrink-0 relative z-10"
      >
        <div className="flex flex-col gap-2">
          <div
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              letterSpacing: '1.2px',
              color: textColor,
            }}
          >
            <InlineEditor
              value={`PROPOSTA ${year}`}
              onChange={(newValue) => onDataChange?.({ year: String(newValue).replace('PROPOSTA ', '') })}
              editable={editable}
              style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1.2px' }}
            />
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 300,
              letterSpacing: '1.2px',
              color: textColor,
            }}
          >
            <InlineEditor
              value={finalCTAText}
              onChange={(newValue) => onDataChange?.({ finalCTAText: String(newValue) })}
              editable={editable}
              style={{ fontSize: '12px', fontWeight: 300, letterSpacing: '1.2px' }}
            />
          </div>
        </div>
        <div className="flex-shrink-0">
          {data.brandLogo ? (
            <img
              src={data.brandLogo}
              alt={data.brandName || 'Logo'}
              style={{
                maxHeight: '48px',
                maxWidth: '200px',
                objectFit: 'contain',
                filter: 'brightness(0) invert(1)',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: textColor,
                letterSpacing: '2px',
              }}
            >
              {data.brandName || 'LOGO'}
            </div>
          )}
        </div>
      </div>

      {/* Center content - Large text */}
      <div className="flex-1 flex items-center justify-start flex-shrink-0 w-full relative z-10">
        <div className="relative w-full">
          <div
            style={{
              fontSize: '70px',
              fontWeight: 300,
              lineHeight: '55px',
              color: textColor,
              letterSpacing: '-3.5px',
              paddingLeft: '40px',
              width: '100%',
            }}
          >
            <InlineEditor
              value="Vamos juntos?"
              onChange={(newValue) => {
                // Store in customContent or finalCTAText
                onDataChange?.({ finalCTAText: String(newValue) });
              }}
              editable={editable}
              type="textarea"
              multiline
              style={{
                fontSize: '70px',
                fontWeight: 300,
                lineHeight: '55px',
                letterSpacing: '-3.5px',
                width: '100%',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

