import React from 'react';
import type { BudgetData, TimelineMilestone } from '../../../types';
import { InlineEditor } from '../InlineEditor';

interface VisantTimelinePageProps {
  data: BudgetData;
  editable?: boolean;
  onDataChange?: (data: Partial<BudgetData>) => void;
}

export const VisantTimelinePage: React.FC<VisantTimelinePageProps> = ({
  data,
  editable = false,
  onDataChange,
}) => {
  const accentColor = data.brandAccentColor || data.brandColors[0] || 'brand-cyan';
  const bgColor = '#151515';
  const textColor = '#f3f3f3';

  // Default timeline milestones
  const defaultTimeline: TimelineMilestone[] = [
    {
      day: 1,
      title: 'Fechamento',
      description: 'do projeto e reserva da agenda de entrega',
    },
    {
      day: 2,
      title: 'Primeira call de alinhamento,',
      description: 'pesquisa de referências',
    },
    {
      day: 8,
      title: 'Estratégia',
      description: 'da marca (posicionamento, público-alvo, arquétipo e mais)',
    },
    {
      day: 15,
      title: 'Processo criativo',
      description: 'do logo e identidade visual',
    },
    {
      day: 25,
      title: 'Refinamento final',
      description: ', criação do manual e apresentação',
    },
    {
      day: 30,
      title: 'Apresentação e Entrega',
      description: '',
    },
  ];

  const timeline = data.timeline && data.timeline.length > 0
    ? data.timeline
    : defaultTimeline;

  // Diamond icon SVG
  const DiamondIcon = () => (
    <svg width="19" height="31" viewBox="0 0 19 31" fill="none">
      <path
        d="M9.5 0L19 15.5L9.5 31L0 15.5L9.5 0Z"
        fill={accentColor}
        fillOpacity="0.8"
      />
    </svg>
  );

  // Timeline node component with different fill states
  const TimelineNode: React.FC<{ day: number; index: number; total: number }> = ({ day, index, total }) => {
    const fillProgress = (index + 1) / total; // 0 to 1

    // Different node styles based on progress
    const getNodeStyle = () => {
      if (index === 0) {
        // First node - just border
        return {
          border: `2px solid ${accentColor}`,
          backgroundColor: 'transparent',
          boxShadow: 'none',
        };
      } else if (index === 1) {
        // Second node - slight glow
        return {
          border: `2px solid ${accentColor}`,
          backgroundColor: 'transparent',
          boxShadow: `0 0 8px ${accentColor}40`,
        };
      } else if (index === 2) {
        // Third node - more glow
        return {
          border: `2px solid ${accentColor}`,
          backgroundColor: `${accentColor}30`,
          boxShadow: `0 0 12px ${accentColor}60`,
        };
      } else if (index === 3) {
        // Fourth node - strong glow
        return {
          border: `2px solid ${accentColor}`,
          backgroundColor: `${accentColor}60`,
          boxShadow: `0 0 16px ${accentColor}80`,
        };
      } else if (index === 4) {
        // Fifth node - almost filled
        return {
          border: `2px solid ${accentColor}`,
          backgroundColor: `${accentColor}90`,
          boxShadow: `0 0 20px ${accentColor}`,
        };
      } else {
        // Last node - fully filled
        return {
          border: `2px solid ${accentColor}`,
          backgroundColor: accentColor,
          boxShadow: `0 0 24px ${accentColor}`,
        };
      }
    };

    const nodeStyle = getNodeStyle();

    return (
      <div
        style={{
          position: 'relative',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            ...nodeStyle,
            transition: 'all 0.3s ease',
          }}
        />
      </div>
    );
  };

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        minHeight: '750px', // A4 height for 800px width (800 * 1.414)
      }}
    >
      {/* Header with diamond icon and title */}
      <div className="flex items-center justify-center mb-12 pt-12 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <DiamondIcon />
          </div>
          <div
            style={{
              border: `1px solid ${textColor}`,
              borderRadius: 'var(--radius)',
              padding: '8px 24px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <InlineEditor
              value="TIMELINE DO PROJETO"
              onChange={() => { }}
              editable={false}
              style={{
                fontSize: '17.517px',
                fontWeight: 'bold',
                letterSpacing: '0.35px',
                color: textColor,
                textAlign: 'center',
              }}
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 relative flex items-center" style={{ paddingLeft: '98px', minHeight: '850px', }}>
        {/* Vertical line */}
        <div
          style={{
            position: 'absolute',
            left: '217px',
            top: '50%',
            transform: 'translateY(-50%)',
            height: '500px',
            width: '1px',
            background: `linear-gradient(to bottom, ${accentColor}20, ${textColor})`,
            opacity: 0.5,
            zIndex: 1,
          }}
        />

        {/* Timeline items */}
        <div className="relative" style={{ height: '750px', zIndex: 2, width: '100%' }}>
          {timeline.map((milestone, index) => {
            const topPositions = [6, 125, 244, 363, 488, 613];
            const topPosition = topPositions[index] || 0;
            return (
              <div
                key={index}
                className="flex items-start gap-6"
                style={{
                  position: 'absolute',
                  left: '0',
                  top: `${topPosition}px`,
                  width: '100%',
                }}
              >
                {/* Day label and node */}
                <div className="flex items-center gap-3 relative" style={{ width: '130px', flexShrink: 0, zIndex: 3, justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      border: `1px solid ${textColor}`,
                      borderRadius: 'var(--radius)',
                      padding: '3px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <InlineEditor
                      value={`DIA ${milestone.day}`}
                      onChange={(newValue) => {
                        const dayMatch = String(newValue).match(/DIA\s*(\d+)/i) || String(newValue).match(/(\d+)/);
                        const day = dayMatch ? parseInt(dayMatch[1], 10) : milestone.day;
                        const updated = [...timeline];
                        updated[index] = {
                          ...updated[index],
                          day: day,
                        };
                        onDataChange?.({ timeline: updated });
                      }}
                      editable={editable}
                      style={{
                        fontSize: '14.89px',
                        fontWeight: 300,
                        color: textColor,
                        letterSpacing: '0.3px',
                        textAlign: 'right',
                      }}
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <TimelineNode day={milestone.day} index={index} total={timeline.length} />
                  </div>
                </div>

                {/* Description */}
                <div
                  style={{
                    fontSize: '18.078px',
                    fontWeight: 400,
                    lineHeight: '1.18',
                    color: textColor,
                    flex: 1,
                    paddingTop: index === 0 ? '6px' : '0',
                    maxWidth: '400px',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 'bold' }}>
                      <InlineEditor
                        value={milestone.title || ''}
                        onChange={(newValue) => {
                          const updated = [...timeline];
                          updated[index] = {
                            ...updated[index],
                            title: String(newValue),
                          };
                          onDataChange?.({ timeline: updated });
                        }}
                        editable={editable}
                        style={{
                          fontSize: '18px',
                          fontWeight: 'bold',
                          lineHeight: '1.18',
                          color: textColor,
                        }}
                      />
                    </span>
                    <span>
                      {' '}
                      <InlineEditor
                        value={milestone.description || ''}
                        onChange={(newValue) => {
                          const updated = [...timeline];
                          updated[index] = {
                            ...updated[index],
                            description: String(newValue),
                          };
                          onDataChange?.({ timeline: updated });
                        }}
                        editable={editable}
                        style={{
                          fontSize: '15px',
                          fontWeight: 400,
                          lineHeight: '1.18',
                          color: textColor,
                        }}
                      />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom gradient decoration */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '359px',
          background: `linear-gradient(to top, ${accentColor}20, transparent)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    </div>
  );
};

