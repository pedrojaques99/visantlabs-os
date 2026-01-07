import React from 'react';
import type { BudgetData } from '../../../types';
import { InlineEditor } from '../InlineEditor';

interface VisantCoverPageProps {
  data: BudgetData;
  editable?: boolean;
  onDataChange?: (data: Partial<BudgetData>) => void;
}

export const VisantCoverPage: React.FC<VisantCoverPageProps> = ({
  data,
  editable = false,
  onDataChange,
}) => {
  const accentColor = data.brandAccentColor || data.brandColors[0] || 'brand-cyan';
  const bgColor = data.coverBackgroundColor || '#151515';
  const textColor = data.coverTextColor || '#f9f9f9';
  const year = data.year || '2025';


  return (
    <div
      className="w-full h-full flex flex-col justify-between relative overflow-hidden"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        minHeight: '850px', // A4 height for 800px width (800 * 1.414)
        padding: '60px',
      }}
    >
      {/* Top section - Logo and title */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ paddingBottom: '40px' }}
      >
        <div className="flex flex-col gap-3 items-center text-center">
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
              value="VAMOS CONSTRUIR ALGO GRANDE JUNTOS?"
              onChange={(newValue) => onDataChange?.({ finalCTAText: String(newValue) })}
              editable={editable}
              style={{ fontSize: '12px', fontWeight: 300, letterSpacing: '1.2px' }}
            />
          </div>
        </div>
      </div>

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center flex-shrink-0">
        <div className="text-center">
          {/* Logo */}
          {data.brandLogo && (
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
              <img
                src={data.brandLogo}
                alt={data.brandName || 'Logo'}
                style={{
                  maxHeight: '120px',
                  maxWidth: '300px',
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)',
                }}
              />
            </div>
          )}
          <div
            style={{
              fontSize: '12px',
              fontWeight: 300,
              letterSpacing: '2.4px',
              color: textColor,
              marginBottom: '12px',
            }}
          >
            <InlineEditor
              value={data.serviceTitle || 'BRANDING COMPLETO'}
              onChange={(newValue) => onDataChange?.({ serviceTitle: String(newValue) })}
              editable={editable}
              style={{ fontSize: '12px', fontWeight: 300, letterSpacing: '2.4px' }}
            />
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              letterSpacing: '2.4px',
              color: textColor,
              textAlign: 'center',
            }}
          >
            <InlineEditor
              value={`ORÇAMENTO`}
              onChange={(newValue) => onDataChange?.({ year: String(newValue).replace('ORÇAMENTO ', '') })}
              editable={editable}
              style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '2.4px', textAlign: 'center', display: 'block', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <div className="flex-shrink-0" style={{ paddingBottom: '140px', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '24px 32px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${accentColor}20`,
            borderRadius: 'var(--radius)',
            backdropFilter: 'blur(10px)',
            boxShadow: `0 4px 20px ${accentColor}10`,
          }}
        >
          <div
            style={{
              fontSize: '21px',
              fontWeight: 800,
              color: textColor,
              letterSpacing: '0.5px',
            }}
          >
            <InlineEditor
              value="Branding "
              onChange={() => { }}
              editable={false}
              style={{ fontSize: '21px', fontWeight: 800 }}
            />
            <InlineEditor
              value="COMPLETO+"
              onChange={() => { }}
              editable={false}
              style={{
                fontSize: '21px',
                fontWeight: 800,
                color: accentColor,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
